targetScope = 'subscription'

@minLength(1)
@maxLength(32)
@description('azd environment name; used for resource group and naming.')
param environmentName string

@description('Azure region for the resource group and resources.')
param location string = 'eastasia'

@description('Region for the Foundry (AIServices) account; must offer the chosen models.')
@description('Region for Cosmos DB (East Asia has had capacity limits).')
param cosmosLocation string = 'southeastasia'
param foundryLocation string = 'eastus2'

@description('Customer / team name; used for tagging and the Foundry project name.')
@minLength(1)
@maxLength(24)
param customerName string = 'skyflow'

@description('Environment type: controls scale-to-zero and replica counts.')
@allowed(['dev', 'staging', 'prod'])
param environmentType string = 'dev'

@description('Static Web Apps SKU.')
@allowed(['Free', 'Standard'])
param swaSku string = 'Standard'

@description('Monthly budget in USD.')
param monthlyBudgetUsd int = 10000

@description('Email addresses notified on budget thresholds and alerts.')
param budgetContactEmails array

@description('Budget start date (first day of a month, yyyy-MM-dd).')
param budgetStartDate string = '${utcNow('yyyy-MM')}-01'

// Boolean / numeric feature flags are strings so azd env substitution in main.parameters.json works.
@description('Deploy the Foundry model deployments.')
@allowed(['true', 'false'])
param deployModels string = 'true'

@description('Primary (reasoning) model name.')
param primaryModelName string = 'gpt-4.1'
@description('Primary model version.')
param primaryModelVersion string = '2025-04-14'
@description('Primary model deployment SKU.')
param primaryModelSku string = 'GlobalStandard'
@description('Primary model capacity (thousands of tokens per minute).')
param primaryModelCapacity string = '50'

@description('Fast (small) model name.')
param fastModelName string = 'gpt-4.1-mini'
@description('Fast model version.')
param fastModelVersion string = '2025-04-14'
@description('Fast model deployment SKU.')
param fastModelSku string = 'GlobalStandard'
@description('Fast model capacity (thousands of tokens per minute).')
param fastModelCapacity string = '100'

@description('Deploy Azure AI Content Safety.')
@allowed(['true', 'false'])
param enableContentSafety string = 'true'

@description('Deploy availability tests, metric alerts, action group and workbook.')
@allowed(['true', 'false'])
param enableMonitoringAlerts string = 'true'

@description('Link agent-api as the Static Web App backend (/api/*). Standard SKU only.')
@allowed(['true', 'false'])
param linkSwaBackend string = 'true'

@description('Add a VNet and private endpoints for Cosmos DB, Key Vault and AI accounts.')
@allowed(['true', 'false'])
param enablePrivateNetworking string = 'false'

@description('Enable Key Vault purge protection (cannot be disabled once enabled).')
@allowed(['true', 'false'])
param enablePurgeProtection string = 'true'

@description('Use Cosmos DB serverless (otherwise autoscale 1000 RU/s max).')
@allowed(['true', 'false'])
param cosmosServerless string = 'true'

@description('Log Analytics retention in days.')
param logRetentionDays int = 30

@description('Log Analytics daily ingestion cap in GB.')
param logDailyQuotaGb int = 5

@description('Entra ID app registration (client) ID for SWA auth. Leave empty to use the SWA built-in provider.')
param aadClientId string = ''

@secure()
@description('Entra ID app client secret for SWA auth.')
param aadClientSecret string = ''

@description('Disable API token validation (demo only). Defaults to true when no API audience is set.')
@allowed(['true', 'false', 'auto'])
param authDisabled string = 'auto'

@description('API audience (App ID URI) validated by agent-api.')
param apiAudience string = ''

@secure()
@description('Teams incoming webhook URL stored in Key Vault. Empty creates a placeholder.')
param teamsWebhookUrl string = ''

@description('Extra CORS origins for agent-api (e.g. custom domains).')
param additionalCorsOrigins array = []

@description('Application Insights availability test locations.')
param availabilityTestLocations array = [
  'apac-jp-kaw-edge'
  'apac-hk-hkn-azr'
  'emea-sg-sin-azr'
]

@description('azd: set automatically so reprovisioning keeps the deployed image.')
param engineMcpExists bool = false
param agentApiExists bool = false
param schedulerExists bool = false

var tags = {
  'azd-env-name': environmentName
  application: 'skyflow-ai'
  customer: customerName
  environmentType: environmentType
}
var token = toLower(uniqueString(subscription().id, environmentName, location))

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    token: token
    cosmosLocation: cosmosLocation
    foundryLocation: foundryLocation
    customerName: customerName
    environmentType: environmentType
    swaSku: swaSku
    budgetContactEmails: budgetContactEmails
    deployModels: deployModels == 'true'
    primaryModel: {
      name: primaryModelName
      version: primaryModelVersion
      sku: primaryModelSku
      capacity: int(primaryModelCapacity)
    }
    fastModel: {
      name: fastModelName
      version: fastModelVersion
      sku: fastModelSku
      capacity: int(fastModelCapacity)
    }
    enableContentSafety: enableContentSafety == 'true'
    enableAlerts: enableMonitoringAlerts == 'true'
    linkSwaBackend: linkSwaBackend == 'true'
    enablePrivateNetworking: enablePrivateNetworking == 'true'
    enablePurgeProtection: enablePurgeProtection == 'true'
    cosmosServerless: cosmosServerless == 'true'
    logRetentionDays: logRetentionDays
    logDailyQuotaGb: logDailyQuotaGb
    aadClientId: aadClientId
    aadClientSecret: aadClientSecret
    authDisabled: authDisabled == 'auto' ? empty(apiAudience) : authDisabled == 'true'
    apiAudience: apiAudience
    teamsWebhookUrl: teamsWebhookUrl
    additionalCorsOrigins: additionalCorsOrigins
    availabilityTestLocations: availabilityTestLocations
    engineMcpExists: engineMcpExists
    agentApiExists: agentApiExists
    schedulerExists: schedulerExists
  }
}

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: 'budget-${environmentName}'
  properties: {
    category: 'Cost'
    amount: monthlyBudgetUsd
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
    }
    notifications: {
      actual50: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
      }
      actual80: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
      }
      actual100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
      }
      forecast110: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 110
        thresholdType: 'Forecasted'
        contactEmails: budgetContactEmails
      }
    }
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output WEB_URI string = resources.outputs.webUri
output API_URI string = resources.outputs.apiUri
output VITE_AGENT_API_URL string = resources.outputs.apiUri
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.acrLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.acrName
output AZURE_CONTAINER_ENVIRONMENT_NAME string = resources.outputs.containerAppsEnvironment
output FOUNDRY_ENDPOINT string = resources.outputs.foundryEndpoint
output FOUNDRY_PROJECT_ENDPOINT string = resources.outputs.foundryProjectEndpoint
output FOUNDRY_ACCOUNT_NAME string = resources.outputs.foundryAccountName
output COSMOS_ENDPOINT string = resources.outputs.cosmosEndpoint
output CONTENT_SAFETY_ENDPOINT string = resources.outputs.contentSafetyEndpoint
output KEY_VAULT_NAME string = resources.outputs.keyVaultName
output KEY_VAULT_URI string = resources.outputs.keyVaultUri
output MANAGED_IDENTITY_CLIENT_ID string = resources.outputs.managedIdentityClientId
output LOG_ANALYTICS_WORKSPACE_ID string = resources.outputs.logAnalyticsWorkspaceId
