param location string
param tags object
param token string

var zoneNames = [
  'privatelink.cognitiveservices.azure.com'
  'privatelink.openai.azure.com'
  'privatelink.services.ai.azure.com'
  'privatelink.documents.azure.com'
  'privatelink.vaultcore.azure.net'
]

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'vnet-${token}'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.20.0.0/16'] }
    subnets: [
      {
        name: 'snet-cae'
        properties: {
          addressPrefix: '10.20.0.0/23'
          delegations: [
            {
              name: 'containerapps'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
      {
        name: 'snet-pe'
        properties: { addressPrefix: '10.20.2.0/24' }
      }
    ]
  }
}

resource zones 'Microsoft.Network/privateDnsZones@2024-06-01' = [for zone in zoneNames: {
  name: zone
  location: 'global'
  tags: tags
}]

resource links 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [for (zone, i) in zoneNames: {
  parent: zones[i]
  name: 'link-${token}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}]

output caeSubnetId string = vnet.properties.subnets[0].id
output peSubnetId string = vnet.properties.subnets[1].id
// Order: cognitiveservices, openai, services.ai, cosmos (documents), key vault
output zoneIds array = [for (zone, i) in zoneNames: zones[i].id]
