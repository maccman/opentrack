import { BigQueryIntegration } from '@integrations/bigquery'
import { CustomerioIntegration } from '@integrations/customerio'

import { BaseIntegrationManager } from './base-manager'

export class IntegrationManager extends BaseIntegrationManager {
  constructor() {
    super([BigQueryIntegration, CustomerioIntegration])
  }
}
