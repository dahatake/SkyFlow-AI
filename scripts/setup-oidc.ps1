<#
 Creates an Entra app registration with a GitHub OIDC federated credential and grants it deploy rights,
 then prints the repository variables that .github/workflows/cd.yml needs. No secrets are created.
 Usage: ./scripts/setup-oidc.ps1 -SubscriptionId <id> -Repo owner/name [-Environment production]
#>
param(
  [Parameter(Mandatory)][string]$SubscriptionId,
  [Parameter(Mandatory)][string]$Repo,
  [string]$Environment = 'production',
  [string]$AppName = 'skyflow-ai-github-cd'
)
$ErrorActionPreference = 'Stop'
az account set --subscription $SubscriptionId
$tenant = az account show --query tenantId -o tsv
$appId = az ad app list --display-name $AppName --query '[0].appId' -o tsv
if (-not $appId) { $appId = az ad app create --display-name $AppName --query appId -o tsv }
if (-not (az ad sp show --id $appId 2>$null)) { az ad sp create --id $appId | Out-Null }
$cred = @{ name = "gh-$Environment"; issuer = 'https://token.actions.githubusercontent.com'; subject = "repo:${Repo}:environment:$Environment"; audiences = @('api://AzureADTokenExchange') } | ConvertTo-Json
$tmp = New-TemporaryFile; Set-Content $tmp $cred
az ad app federated-credential create --id $appId --parameters "@$tmp" 2>$null | Out-Null
Remove-Item $tmp
# Contributor + User Access Administrator are needed because the Bicep creates role assignments.
foreach ($role in 'Contributor', 'User Access Administrator') {
  az role assignment create --assignee $appId --role $role --scope "/subscriptions/$SubscriptionId" 2>$null | Out-Null
}
Write-Host "`nSet these GitHub repository (or environment '$Environment') variables:"
Write-Host "  AZURE_CLIENT_ID       = $appId"
Write-Host "  AZURE_TENANT_ID       = $tenant"
Write-Host "  AZURE_SUBSCRIPTION_ID = $SubscriptionId"
Write-Host "  AZURE_ENV_NAME, AZURE_LOCATION, BUDGET_CONTACT_EMAIL = your values"
