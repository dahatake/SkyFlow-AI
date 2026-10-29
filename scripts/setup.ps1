# One-command local setup: installs app dependencies, validates customers, runs the tests.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\app')
$node = [int](node -p "process.versions.node.split('.')[0]")
if ($node -lt 22) { throw "Node 22+ required (found $node). See app/.nvmrc." }
npm ci
npm run validate:customer
npm test
Write-Host "Ready. Run: cd app; npm run dev"
