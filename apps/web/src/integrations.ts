import { IntegrationManager } from '@app/core'
import type { Integration } from '@app/spec'
import { BigQueryIntegration, type BigQueryIntegrationConfig } from '@integrations/bigquery'
import { CustomerioIntegration, type CustomerioConfig } from '@integrations/customerio'

function createIntegrations(): Integration[] {
  const integrations: Integration[] = []

  // BigQuery Integration
  const bigQueryProjectId = process.env.BIGQUERY_PROJECT_ID
  const bigQueryDataset = process.env.BIGQUERY_DATASET
  if (bigQueryProjectId && bigQueryDataset) {
    const bigQueryConfig: BigQueryIntegrationConfig = {
      projectId: bigQueryProjectId,
      datasetId: bigQueryDataset,
      autoTableManagement: process.env.BIGQUERY_AUTO_TABLE_MANAGEMENT !== 'false', // Default to true
    }
    integrations.push(new BigQueryIntegration(bigQueryConfig))
  }

  // Customer.io Integration
  const customerioSiteId = process.env.CUSTOMERIO_SITE_ID
  const customerioApiKey = process.env.CUSTOMERIO_API_KEY
  if (customerioSiteId && customerioApiKey) {
    const customerioConfig: CustomerioConfig = {
      siteId: customerioSiteId,
      apiKey: customerioApiKey,
      region: process.env.CUSTOMERIO_REGION?.toUpperCase() === 'EU' ? 'EU' : 'US',
    }
    integrations.push(new CustomerioIntegration(customerioConfig))
  }

  return integrations
}

export const integrationManager = new IntegrationManager(createIntegrations())
