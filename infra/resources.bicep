param location string
param tags object
param token string
param swaSku string

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${token}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: 1 }
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

// Static Web Apps is only available in a subset of regions; East Asia is supported.
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

output webUri string = 'https://${web.properties.defaultHostname}'
output appInsightsConnectionString string = appInsights.properties.ConnectionString
