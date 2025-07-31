import { IntegrationManager } from '@app/core'
import type { Integration } from '@app/spec'
import { BigQueryIntegration } from '@integrations/bigquery'
import { CustomerioIntegration } from '@integrations/customerio'

const integrations: Integration[] = [
  ...(BigQueryIntegration.isEnabled() ? [new BigQueryIntegration()] : []),
  ...(CustomerioIntegration.isEnabled() ? [new CustomerioIntegration()] : []),
]

export const integrationManager = new IntegrationManager(integrations)
