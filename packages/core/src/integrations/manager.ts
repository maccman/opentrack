import { BigQueryIntegration } from '@integrations/bigquery'

import { BaseIntegrationManager } from './base-manager'

export class IntegrationManager extends BaseIntegrationManager {
  constructor() {
    super([BigQueryIntegration])
  }
}
