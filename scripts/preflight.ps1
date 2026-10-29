<#
.SYNOPSIS
  Pre-deployment checks for `azd up` (login, subscription, providers, region, model quota).
.EXAMPLE
  ./scripts/preflight.ps1 -SubscriptionId d8352616-ed51-492b-929b-5e266d38aedd -Location eastasia -FoundryLocation eastus2
#>
[CmdletBinding()]
param(
  [string]$SubscriptionId = $env:AZURE_SUBSCRIPTION_ID,
  [string]$Location = $(if ($env:AZURE_LOCATION) { $env:AZURE_LOCATION } else { 'eastasia' }),
  [string]$FoundryLocation = $(if ($env:FOUNDRY_LOCATION) { $env:FOUNDRY_LOCATION } else { 'eastus2' }),
  [string]$PrimaryModel = $(if ($env:FOUNDRY_MODEL_PRIMARY) { $env:FOUNDRY_MODEL_PRIMARY } else { 'gpt-4.1' }),
  [string]$PrimarySku = $(if ($env:FOUNDRY_MODEL_PRIMARY_SKU) { $env:FOUNDRY_MODEL_PRIMARY_SKU } else { 'GlobalStandard' }),
  [int]$PrimaryCapacity = $(if ($env:FOUNDRY_MODEL_PRIMARY_CAPACITY) { [int]$env:FOUNDRY_MODEL_PRIMARY_CAPACITY } else { 50 }),
  [string]$FastModel = $(if ($env:FOUNDRY_MODEL_FAST) { $env:FOUNDRY_MODEL_FAST } else { 'gpt-4.1-mini' }),
  [string]$FastSku = $(if ($env:FOUNDRY_MODEL_FAST_SKU) { $env:FOUNDRY_MODEL_FAST_SKU } else { 'GlobalStandard' }),
  [int]$FastCapacity = $(if ($env:FOUNDRY_MODEL_FAST_CAPACITY) { [int]$env:FOUNDRY_MODEL_FAST_CAPACITY } else { 100 }),
  [switch]$SkipModels
)

$ErrorActionPreference = 'Continue'
$script:errors = 0
function Ok($m)   { Write-Host "[ OK ] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m, $fix) { $script:errors++; Write-Host "[FAIL] $m" -ForegroundColor Red; if ($fix) { Write-Host "       Fix: $fix" } }

foreach ($tool in 'az', 'azd') {
  if (Get-Command $tool -ErrorAction SilentlyContinue) { Ok "$tool installed" }
  else { Fail "$tool not found" "Install from https://aka.ms/install-$tool" }
}
if ($script:errors) { exit 1 }

az account show --query id -o tsv 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'az is not logged in' 'az login' ; exit 1 } else { Ok 'az logged in' }

azd auth login --check-status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'azd is not logged in' 'azd auth login' } else { Ok 'azd logged in' }

if ($SubscriptionId) {
  az account set --subscription $SubscriptionId 2>$null
  if ($LASTEXITCODE -ne 0) { Fail "Subscription $SubscriptionId not accessible" "az login; az account list -o table"; exit 1 }
}
$sub = az account show --query id -o tsv
Ok "Using subscription $sub"
if (-not $SubscriptionId) { Warn "No -SubscriptionId given; set one explicitly (azd env set AZURE_SUBSCRIPTION_ID <id>)." }

$providers = 'Microsoft.App', 'Microsoft.ContainerRegistry', 'Microsoft.CognitiveServices', 'Microsoft.DocumentDB',
  'Microsoft.KeyVault', 'Microsoft.OperationalInsights', 'Microsoft.Insights', 'Microsoft.Web', 'Microsoft.ManagedIdentity',
  'Microsoft.Network', 'Microsoft.Consumption', 'Microsoft.Authorization'
$states = az provider list --query "[].{n:namespace,s:registrationState}" -o json | ConvertFrom-Json
foreach ($p in $providers) {
  $s = ($states | Where-Object { $_.n -eq $p }).s
  if ($s -eq 'Registered') { Ok "Provider $p registered" }
  else { Fail "Provider $p is '$s'" "az provider register --namespace $p --wait" }
}

$locs = az account list-locations --query "[].name" -o json | ConvertFrom-Json
foreach ($l in @($Location, $FoundryLocation) | Select-Object -Unique) {
  if ($locs -contains $l) { Ok "Region $l exists" } else { Fail "Region '$l' not available to this subscription" 'az account list-locations -o table' }
}

$swaRegions = 'westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'
if ($swaRegions -notcontains $Location) { Warn "Static Web Apps is only available in: $($swaRegions -join ', '). '$Location' may fail." }

$caRegions = az provider show -n Microsoft.App --query "resourceTypes[?resourceType=='managedEnvironments'].locations[]" -o json | ConvertFrom-Json
$norm = { param($x) ($x -replace '\s', '').ToLower() }
if ($caRegions -and -not ($caRegions | Where-Object { (& $norm $_) -eq (& $norm $Location) })) { Fail "Container Apps not available in '$Location'" 'Pick a supported AZURE_LOCATION' }
else { Ok "Container Apps available in $Location" }

if (-not $SkipModels -and $env:DEPLOY_MODELS -ne 'false') {
  $usage = az cognitiveservices usage list --location $FoundryLocation -o json 2>$null | ConvertFrom-Json
  $available = az cognitiveservices model list --location $FoundryLocation -o json 2>$null | ConvertFrom-Json
  foreach ($m in @(@($PrimaryModel, $PrimarySku, $PrimaryCapacity), @($FastModel, $FastSku, $FastCapacity))) {
    $name, $sku, $cap = $m
    $found = $available | Where-Object { $_.model.name -eq $name -and ($_.model.skus.name -contains $sku) }
    if (-not $found) { Fail "Model '$name' with SKU '$sku' not offered in $FoundryLocation" "az cognitiveservices model list -l $FoundryLocation -o table  (then set FOUNDRY_LOCATION / FOUNDRY_MODEL_* )"; continue }
    $key = "OpenAI.$sku.$name"
    $u = $usage | Where-Object { $_.name.value -eq $key }
    if ($u) {
      $free = [math]::Floor($u.limit - $u.currentValue)
      if ($free -ge $cap) { Ok "Quota $key : $free K TPM free (need $cap)" }
      else { Fail "Quota $key : only $free K TPM free, need $cap" "Lower FOUNDRY_MODEL_*_CAPACITY or request quota at https://aka.ms/oai/stuquotarequest" }
    } else { Warn "No quota record for $key in $FoundryLocation; verify in Foundry portal > Quotas." }
  }
}

if ($script:errors) { Write-Host "`n$($script:errors) check(s) failed." -ForegroundColor Red; exit 1 }
Write-Host "`nPreflight passed." -ForegroundColor Green
