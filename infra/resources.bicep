param location string
param cosmosLocation string
param foundryLocation string
param tags object
@minLength(8)
param token string
param customerName string
param environmentType string
param swaSku string
param budgetContactEmails array

param deployModels bool
param primaryModel object
param fastModel object
param enableContentSafety bool
param enableAlerts bool
param linkSwaBackend bool
param enablePrivateNetworking bool
param enablePurgeProtection bool
param cosmosServerless bool
param logRetentionDays int
param logDailyQuotaGb int

param aadClientId string
@secure()
param aadClientSecret string
param authDisabled bool
param apiAudience string
@secure()
param teamsWebhookUrl string
param additionalCorsOrigins array
param availabilityTestLocations array

param engineMcpExists bool
param agentApiExists bool
param schedulerExists bool

var isProd = environmentType == 'prod'
var minReplicas = isProd ? 1 : 0
var placeholderImage = 'mcr.microsoft.com/dotnet/samples:aspnetapp'
var tenantId = tenant().tenantId

// Built-in role definition IDs
var roles = {
  openAiUser: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
  azureAiUser: '53ca6127-db72-4b80-b1b0-d745d6d5456d'
  cognitiveServicesUser: 'a97b65f3-24c7-4388-baec-2e87135dc908'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
}

// ---------- Identity & monitoring ----------

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${token}'
  location: location
  tags: tags
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${token}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: logRetentionDays
    workspaceCapping: { dailyQuotaGb: logDailyQuotaGb }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${token}'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// ---------- Network (optional) ----------

module network 'modules/network.bicep' = if (enablePrivateNetworking) {
  name: 'network'
  params: {
    location: location
    tags: tags
    token: token
  }
}

// ---------- Registry ----------

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'cr${token}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, identity.id, roles.acrPull)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
  }
}

// ---------- Key Vault ----------

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${token}'
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: enablePurgeProtection ? true : null
    publicNetworkAccess: enablePrivateNetworking ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: enablePrivateNetworking ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource teamsSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'teams-webhook-url'
  properties: {
    value: empty(teamsWebhookUrl) ? 'https://placeholder.invalid/replace-me' : teamsWebhookUrl
  }
}

resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kv
  name: guid(kv.id, identity.id, roles.keyVaultSecretsUser)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
  }
}

// ---------- Cosmos DB ----------

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: 'cosmos-${token}'
  location: cosmosLocation
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    disableLocalAuth: true
    publicNetworkAccess: enablePrivateNetworking ? 'Disabled' : 'Enabled'
    minimalTlsVersion: 'Tls12'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [
      {
        locationName: cosmosLocation
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: cosmosServerless ? [{ name: 'EnableServerless' }] : []
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmos
  name: 'skyflow'
  properties: {
    resource: { id: 'skyflow' }
    options: cosmosServerless ? {} : { autoscaleSettings: { maxThroughput: 1000 } }
  }
}

resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = [for c in ['proposals', 'audit']: {
  parent: cosmosDb
  name: c
  properties: {
    resource: {
      id: c
      partitionKey: { paths: ['/demoId'], kind: 'Hash' }
    }
  }
}]

resource cosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmos
  name: guid(cosmos.id, identity.id, 'data-contributor')
  properties: {
    principalId: identity.properties.principalId
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    scope: cosmos.id
  }
}

// ---------- Microsoft Foundry (AIServices) ----------

var foundryName = 'aif-${token}'

resource foundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: foundryName
  location: foundryLocation
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: foundryName
    allowProjectManagement: true
    publicNetworkAccess: enablePrivateNetworking ? 'Disabled' : 'Enabled'
    disableLocalAuth: true
    networkAcls: { defaultAction: enablePrivateNetworking ? 'Deny' : 'Allow' }
  }
}

resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundry
  name: '${customerName}-project'
  location: foundryLocation
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    displayName: '${customerName} project'
    description: 'SkyFlow AI agents project'
  }
  dependsOn: [fastDeployment]
}

resource appInsightsConnection 'Microsoft.CognitiveServices/accounts/connections@2025-06-01' = {
  parent: foundry
  name: 'appinsights'
  properties: {
    category: 'AppInsights'
    target: appInsights.id
    authType: 'ApiKey'
    isSharedToAll: true
    credentials: { key: appInsights.properties.ConnectionString }
    metadata: {
      ApiType: 'Azure'
      ResourceId: appInsights.id
    }
  }
  dependsOn: [foundryProject]
}

resource primaryDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = if (deployModels) {
  parent: foundry
  name: primaryModel.name
  sku: {
    name: primaryModel.sku
    capacity: primaryModel.capacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: primaryModel.name
      version: primaryModel.version
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource fastDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = if (deployModels) {
  parent: foundry
  name: fastModel.name
  sku: {
    name: fastModel.sku
    capacity: fastModel.capacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: fastModel.name
      version: fastModel.version
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [primaryDeployment]
}

var foundryRoleIds = [roles.openAiUser, roles.azureAiUser, roles.cognitiveServicesUser]

resource foundryRoles 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for roleId in foundryRoleIds: {
  scope: foundry
  name: guid(foundry.id, identity.id, roleId)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
  }
}]

// ---------- Content Safety ----------

resource contentSafety 'Microsoft.CognitiveServices/accounts@2025-06-01' = if (enableContentSafety) {
  name: 'cs-${token}'
  location: foundryLocation
  tags: tags
  kind: 'ContentSafety'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: 'cs-${token}'
    publicNetworkAccess: enablePrivateNetworking ? 'Disabled' : 'Enabled'
    disableLocalAuth: true
    networkAcls: { defaultAction: enablePrivateNetworking ? 'Deny' : 'Allow' }
  }
}

resource contentSafetyRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableContentSafety) {
  scope: contentSafety
  name: guid(contentSafety.id, identity.id, roles.cognitiveServicesUser)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesUser)
  }
}

// ---------- Private endpoints (optional) ----------
// zoneIds order: cognitiveservices, openai, services.ai, cosmos, key vault

var peSubnetId = network.?outputs.peSubnetId ?? ''
var zoneIds = network.?outputs.zoneIds ?? ['', '', '', '', '']

module peFoundry 'modules/privateEndpoint.bicep' = if (enablePrivateNetworking) {
  name: 'pe-foundry'
  params: {
    name: 'pe-aif-${token}'
    location: location
    tags: tags
    subnetId: peSubnetId
    targetId: foundry.id
    groupIds: ['account']
    zoneIds: [zoneIds[0], zoneIds[1], zoneIds[2]]
  }
}

module peContentSafety 'modules/privateEndpoint.bicep' = if (enablePrivateNetworking && enableContentSafety) {
  name: 'pe-contentsafety'
  params: {
    name: 'pe-cs-${token}'
    location: location
    tags: tags
    subnetId: peSubnetId
    targetId: contentSafety.id
    groupIds: ['account']
    zoneIds: [zoneIds[0]]
  }
}

module peCosmos 'modules/privateEndpoint.bicep' = if (enablePrivateNetworking) {
  name: 'pe-cosmos'
  params: {
    name: 'pe-cosmos-${token}'
    location: location
    tags: tags
    subnetId: peSubnetId
    targetId: cosmos.id
    groupIds: ['Sql']
    zoneIds: [zoneIds[3]]
  }
}

module peKeyVault 'modules/privateEndpoint.bicep' = if (enablePrivateNetworking) {
  name: 'pe-kv'
  params: {
    name: 'pe-kv-${token}'
    location: location
    tags: tags
    subnetId: peSubnetId
    targetId: kv.id
    groupIds: ['vault']
    zoneIds: [zoneIds[4]]
  }
}

// ---------- Diagnostics ----------

resource foundryDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: foundry
  name: 'to-log-analytics'
  properties: {
    workspaceId: logs.id
    logs: [{ categoryGroup: 'allLogs', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}

resource contentSafetyDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (enableContentSafety) {
  scope: contentSafety
  name: 'to-log-analytics'
  properties: {
    workspaceId: logs.id
    logs: [{ categoryGroup: 'allLogs', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}

resource cosmosDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: cosmos
  name: 'to-log-analytics'
  properties: {
    workspaceId: logs.id
    logs: [{ categoryGroup: 'allLogs', enabled: true }]
    metrics: [{ category: 'Requests', enabled: true }]
  }
}

resource kvDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: kv
  name: 'to-log-analytics'
  properties: {
    workspaceId: logs.id
    logs: [{ categoryGroup: 'allLogs', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}

// ---------- Static Web App ----------

resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: 'swa-${token}'
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  sku: {
    name: swaSku
    tier: swaSku
  }
  properties: {}
}

resource webSettings 'Microsoft.Web/staticSites/config@2023-12-01' = if (!empty(aadClientId)) {
  parent: web
  name: 'appsettings'
  properties: {
    AAD_CLIENT_ID: aadClientId
    AAD_CLIENT_SECRET: aadClientSecret
  }
}

// ---------- Container Apps ----------

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${token}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: enablePrivateNetworking ? {
      infrastructureSubnetId: network.?outputs.caeSubnetId ?? ''
      internal: false
    } : null
    workloadProfiles: [
      { name: 'Consumption', workloadProfileType: 'Consumption' }
    ]
    zoneRedundant: false
  }
}

module engineImage 'modules/fetch-latest-image.bicep' = if (engineMcpExists) {
  name: 'engine-mcp-image'
  params: { name: 'ca-engine-mcp-${token}' }
}

module apiImage 'modules/fetch-latest-image.bicep' = if (agentApiExists) {
  name: 'agent-api-image'
  params: { name: 'ca-agent-api-${token}' }
}

module schedulerImage 'modules/fetch-latest-image.bicep' = if (schedulerExists) {
  name: 'scheduler-image'
  params: { name: 'job-sched-${token}', isJob: true }
}

var domain = cae.properties.defaultDomain
var engineName = 'ca-engine-mcp-${token}'
var apiName = 'ca-agent-api-${token}'
var engineUrl = 'https://${engineName}.internal.${domain}'
var publicApiUrl = 'https://${apiName}.${domain}'
var teamsSecretUri = '${kv.properties.vaultUri}secrets/teams-webhook-url'
var csEndpoint = enableContentSafety ? 'https://cs-${token}.cognitiveservices.azure.com/' : ''

var registries = [{ server: acr.properties.loginServer, identity: identity.id }]
var identityBlock = {
  type: 'UserAssigned'
  userAssignedIdentities: { '${identity.id}': {} }
}

var agentEnv = [
  { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
  { name: 'PORT', value: '8080' }
  { name: 'ENGINE_MCP_URL', value: engineUrl }
  { name: 'FOUNDRY_ENDPOINT', value: 'https://${foundryName}.services.ai.azure.com/api/projects/${foundryProject.name}' }
  { name: 'FOUNDRY_OPENAI_ENDPOINT', value: 'https://${foundryName}.openai.azure.com/' }
  { name: 'FOUNDRY_MODEL_PRIMARY', value: primaryModel.name }
  { name: 'FOUNDRY_MODEL_FAST', value: fastModel.name }
  { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
  { name: 'CONTENT_SAFETY_ENDPOINT', value: csEndpoint }
  { name: 'TEAMS_WEBHOOK_URL', secretRef: 'teams-webhook-url' }
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
  { name: 'TENANT_ID', value: tenantId }
  { name: 'API_AUDIENCE', value: apiAudience }
  { name: 'PUBLIC_API_URL', value: publicApiUrl }
  { name: 'AUTH_DISABLED', value: string(authDisabled) }
]

var teamsContainerSecrets = [
  {
    name: 'teams-webhook-url'
    keyVaultUrl: teamsSecretUri
    identity: identity.id
  }
]

resource engineMcp 'Microsoft.App/containerApps@2024-03-01' = {
  name: engineName
  location: location
  tags: union(tags, { 'azd-service-name': 'engine-mcp' })
  identity: identityBlock
  properties: {
    managedEnvironmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registries: registries
    }
    template: {
      containers: [
        {
          name: 'engine-mcp'
          image: engineMcpExists ? (engineImage.?outputs.image ?? placeholderImage) : placeholderImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'PORT', value: '8080' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: isProd ? 5 : 2
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
  dependsOn: [acrPull]
}

resource agentApi 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiName
  location: location
  tags: union(tags, { 'azd-service-name': 'agent-api' })
  identity: identityBlock
  properties: {
    managedEnvironmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
        corsPolicy: {
          allowedOrigins: union(['https://${web.properties.defaultHostname}'], additionalCorsOrigins)
          allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: true
          maxAge: 600
        }
      }
      registries: registries
      secrets: teamsContainerSecrets
    }
    template: {
      containers: [
        {
          name: 'agent-api'
          image: agentApiExists ? (apiImage.?outputs.image ?? placeholderImage) : placeholderImage
          resources: { cpu: json('1'), memory: '2Gi' }
          env: agentEnv
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: isProd ? 10 : 2
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '30' } }
          }
        ]
      }
    }
  }
  dependsOn: [acrPull, kvSecretsUser, teamsSecret]
}

resource scheduler 'Microsoft.App/jobs@2024-03-01' = {
  name: 'job-sched-${token}'
  location: location
  tags: union(tags, { 'azd-service-name': 'scheduler' })
  identity: identityBlock
  properties: {
    environmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 55
      replicaRetryLimit: 0
      scheduleTriggerConfig: {
        cronExpression: '* * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: registries
      secrets: teamsContainerSecrets
    }
    template: {
      containers: [
        {
          name: 'agent-scheduler'
          image: schedulerExists ? (schedulerImage.?outputs.image ?? placeholderImage) : placeholderImage
          command: ['python', '-m', 'agent_api.scheduler']
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: agentEnv
        }
      ]
    }
  }
  dependsOn: [acrPull, kvSecretsUser, teamsSecret]
}

// Linked backend lets the SPA call /api/* on the same origin (Standard SKU only).
resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = if (linkSwaBackend && swaSku == 'Standard') {
  parent: web
  name: 'agent-api'
  properties: {
    backendResourceId: agentApi.id
    region: location
  }
}

module alerts 'modules/monitoring-alerts.bicep' = if (enableAlerts) {
  name: 'monitoring-alerts'
  params: {
    location: location
    tags: tags
    token: token
    appInsightsId: appInsights.id
    agentApiId: agentApi.id
    agentApiFqdn: agentApi.properties.configuration.ingress.fqdn
    swaHostname: web.properties.defaultHostname
    emails: budgetContactEmails
    testLocations: availabilityTestLocations
  }
}

output webUri string = 'https://${web.properties.defaultHostname}'
output apiUri string = publicApiUrl
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output foundryEndpoint string = 'https://${foundryName}.services.ai.azure.com/'
output foundryProjectEndpoint string = 'https://${foundryName}.services.ai.azure.com/api/projects/${foundryProject.name}'
output foundryAccountName string = foundry.name
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output contentSafetyEndpoint string = csEndpoint
output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
output managedIdentityClientId string = identity.properties.clientId
output containerAppsEnvironment string = cae.name
output logAnalyticsWorkspaceId string = logs.id
