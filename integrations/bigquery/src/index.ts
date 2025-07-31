import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import { BigQuery } from '@google-cloud/bigquery'

import { getTableNames, TableManager, transformToRow } from './utils'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

export interface BigQueryIntegrationConfig {
  projectId: string
  datasetId: string
  autoTableManagement?: boolean
}

export class BigQueryIntegration implements Integration {
  public name = 'BigQuery'
  private client: BigQuery
  private tableManager: TableManager | null = null
  private config: BigQueryIntegrationConfig

  constructor(config: BigQueryIntegrationConfig) {
    this.config = {
      autoTableManagement: true,
      ...config,
    }
    this.client = new BigQuery()
    if (this.config.autoTableManagement) {
      this.tableManager = new TableManager(this.client, this.config.projectId)
    }
  }

  private async insert(payload: Payload, tableName: string) {
    if (!this.client || !this.config.datasetId) {
      return
    }

    const row = transformToRow(payload)

    if (this.tableManager) {
      // Use table manager for auto-creation and schema evolution
      const tableType = this.getTableType(tableName)
      await this.tableManager.insertWithAutoSchema(this.config.datasetId, tableName, tableType, [row])
    } else {
      // Direct insertion, will fail if schema is incorrect
      await this.client.dataset(this.config.datasetId).table(tableName).insert([row])
    }
  }

  private getTableType(tableName: string): string {
    // For standard tables, use the payload type
    switch (tableName) {
      case 'identifies':
        return 'identify'
      case 'pages':
        return 'page'
      case 'groups':
        return 'group'
      case 'aliases':
        return 'alias'
      case 'tracks':
        return 'track'
      default:
        // For event-specific tables, use 'track' as the base type
        return 'track'
    }
  }

  private async insertToAllTables(payload: Payload) {
    const tableNames = getTableNames(payload)
    await Promise.all(tableNames.map((tableName) => this.insert(payload, tableName)))
  }

  public async track(payload: TrackPayload): Promise<void> {
    await this.insertToAllTables(payload)
  }

  public async identify(payload: IdentifyPayload): Promise<void> {
    await this.insertToAllTables(payload)
  }

  public async page(payload: PagePayload): Promise<void> {
    await this.insertToAllTables(payload)
  }

  public async group(payload: GroupPayload): Promise<void> {
    await this.insertToAllTables(payload)
  }

  public async alias(payload: AliasPayload): Promise<void> {
    await this.insertToAllTables(payload)
  }
}
