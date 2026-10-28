targetScope = 'subscription'

@minLength(1)
@maxLength(32)
@description('azd environment name; used for resource group and naming.')
param environmentName string

@description('Azure region for the resource group and resources.')
param location string = 'eastasia'

@description('Static Web Apps SKU.')
@allowed(['Free', 'Standard'])
param swaSku string = 'Standard'

@description('Monthly budget in USD.')
param monthlyBudgetUsd int = 1000

@description('Email addresses notified on budget thresholds.')
param budgetContactEmails array

@description('Budget start date (first day of a month, yyyy-MM-dd).')
param budgetStartDate string = '${utcNow('yyyy-MM')}-01'

var tags = {
  'azd-env-name': environmentName
  application: 'skyflow-ai'
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
    swaSku: swaSku
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
