// ---------------------------------------------------------------------------
// TEAM GTD — Azure infrastructure
// Provisions: Cosmos DB (serverless) + Azure Web PubSub + Static Web App
// and wires the Cosmos / Web PubSub connection strings into the Static Web
// App's managed Functions API app settings.
//
// Deploy:
//   az group create -n rg-team-gtd -l westeurope
//   az deployment group create -g rg-team-gtd -f infra/main.bicep \
//       -p namePrefix=teamgtd repositoryUrl=https://github.com/<you>/<repo> branch=main
// ---------------------------------------------------------------------------

@description('Short prefix for resource names (lowercase, 3-11 chars).')
@minLength(3)
@maxLength(11)
param namePrefix string = 'teamgtd'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Location for the Static Web App (limited set of regions).')
@allowed([
  'westeurope'
  'eastus2'
  'centralus'
  'westus2'
  'eastasia'
])
param swaLocation string = 'westeurope'

@description('Web PubSub SKU. Free_F1 for small teams; Standard_S1 for production.')
@allowed([
  'Free_F1'
  'Standard_S1'
])
param webPubSubSku string = 'Free_F1'

@description('GitHub repository URL for the Static Web App (optional, enables CI).')
param repositoryUrl string = ''

@description('Git branch to deploy from.')
param branch string = 'main'

var suffix = uniqueString(resourceGroup().id)
var cosmosName = toLower('${namePrefix}-cosmos-${suffix}')
var wpsName = toLower('${namePrefix}-wps-${suffix}')
var swaName = '${namePrefix}-swa-${suffix}'
var databaseName = 'gtd'
var containerName = 'board'
var hubName = 'boardhub'

// --------------------------- Cosmos DB (serverless) ------------------------
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: false
    capabilities: [
      { name: 'EnableServerless' }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: [ '/id' ]
        kind: 'Hash'
      }
    }
  }
}

// ----------------------------- Web PubSub ----------------------------------
resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: wpsName
  location: location
  sku: {
    name: webPubSubSku
    tier: webPubSubSku == 'Free_F1' ? 'Free' : 'Standard'
    capacity: 1
  }
  properties: {}
}

// --------------------------- Static Web App --------------------------------
resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: swaLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: empty(repositoryUrl) ? null : repositoryUrl
    branch: empty(repositoryUrl) ? null : branch
    buildProperties: {
      appLocation: 'web'
      apiLocation: 'api'
      outputLocation: 'dist'
    }
  }
}

// Wire secrets into the managed Functions app settings.
resource swaSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    COSMOS_CONNECTION_STRING: cosmos.listConnectionStrings().connectionStrings[0].connectionString
    COSMOS_DATABASE: databaseName
    COSMOS_CONTAINER: containerName
    WEBPUBSUB_CONNECTION_STRING: webPubSub.listKeys().primaryConnectionString
    WEBPUBSUB_HUB: hubName
  }
}

output staticWebAppName string = swa.name
output staticWebAppDefaultHostname string = swa.properties.defaultHostname
output cosmosAccountName string = cosmos.name
output webPubSubName string = webPubSub.name
output hubName string = hubName
