param location string
param tags object
param token string
param appInsightsId string
param agentApiId string
param agentApiFqdn string
param swaHostname string
param emails array
param testLocations array

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-${token}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'skyflow'
    enabled: true
    emailReceivers: [for (email, i) in emails: {
      name: 'email${i}'
      emailAddress: email
      useCommonAlertSchema: true
    }]
  }
}

var availabilityTargets = [
  { name: 'swa', url: 'https://${swaHostname}/' }
  { name: 'agent-api', url: 'https://${swaHostname}/api/health' }
]

resource tests 'Microsoft.Insights/webtests@2022-06-15' = [for target in availabilityTargets: {
  name: 'avail-${target.name}-${token}'
  location: location
  tags: union(tags, { 'hidden-link:${appInsightsId}': 'Resource' })
  kind: 'standard'
  properties: {
    Name: 'avail-${target.name}'
    SyntheticMonitorId: 'avail-${target.name}-${token}'
    Enabled: true
    Frequency: 300
    Timeout: 30
    RetryEnabled: true
    Kind: 'standard'
    Locations: [for loc in testLocations: { Id: loc }]
    Request: {
      RequestUrl: target.url
      HttpVerb: 'GET'
      ParseDependentRequests: false
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 7
    }
  }
}]

resource availabilityAlerts 'Microsoft.Insights/metricAlerts@2018-03-01' = [for (target, i) in availabilityTargets: {
  name: 'alert-avail-${target.name}-${token}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Availability test for ${target.name} is failing.'
    severity: 1
    enabled: true
    scopes: [appInsightsId, tests[i].id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: tests[i].id
      componentId: appInsightsId
      failedLocationCount: 2
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}]

resource api5xx 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-agent-api-5xx-${token}'
  location: 'global'
  tags: tags
  properties: {
    description: 'agent-api is returning HTTP 5xx responses.'
    severity: 2
    enabled: true
    scopes: [agentApiId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Http5xx'
          criterionType: 'StaticThresholdCriterion'
          metricNamespace: 'microsoft.app/containerapps'
          metricName: 'Requests'
          dimensions: [
            { name: 'statusCodeCategory', operator: 'Include', values: ['5xx'] }
          ]
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

resource apiRestarts 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-agent-api-restarts-${token}'
  location: 'global'
  tags: tags
  properties: {
    description: 'agent-api containers are restarting repeatedly.'
    severity: 2
    enabled: true
    scopes: [agentApiId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Restarts'
          criterionType: 'StaticThresholdCriterion'
          metricNamespace: 'microsoft.app/containerapps'
          metricName: 'RestartCount'
          operator: 'GreaterThan'
          threshold: 3
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

var workbookData = {
  version: 'Notebook/1.0'
  items: [
    {
      type: 1
      content: { json: '## SkyFlow agent health\nLatency, failures and token/cost-ish counters from Application Insights.' }
      name: 'title'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'requests | where cloud_RoleName has "agent-api" | summarize p50=percentile(duration,50), p95=percentile(duration,95) by bin(timestamp, 5m) | render timechart'
        size: 0
        title: 'agent-api latency (ms)'
        queryType: 0
        resourceType: 'microsoft.insights/components'
      }
      name: 'latency'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'union requests, dependencies, exceptions | where success == false or itemType == "exception" | summarize failures=count() by bin(timestamp, 5m), itemType | render timechart'
        size: 0
        title: 'Failures'
        queryType: 0
        resourceType: 'microsoft.insights/components'
      }
      name: 'failures'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'customMetrics | where name in ("llm.tokens.input", "llm.tokens.output", "gen_ai.client.token.usage") | summarize tokens=sum(valueSum) by bin(timestamp, 1h), name | render columnchart'
        size: 0
        title: 'LLM token counters (cost proxy)'
        queryType: 0
        resourceType: 'microsoft.insights/components'
      }
      name: 'tokens'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'traces | where cloud_RoleName has "scheduler" | summarize runs=count() by bin(timestamp, 15m), severityLevel | render timechart'
        size: 0
        title: 'Scheduler activity'
        queryType: 0
        resourceType: 'microsoft.insights/components'
      }
      name: 'scheduler'
    }
  ]
}

resource workbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid(resourceGroup().id, 'skyflow-agent-workbook')
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: 'SkyFlow agent health'
    category: 'workbook'
    sourceId: appInsightsId
    serializedData: string(workbookData)
  }
}

output actionGroupId string = actionGroup.id
