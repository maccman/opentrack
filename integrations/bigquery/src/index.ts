import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import { BigQuery } from '@google-cloud/bigquery'
import { getTableNames, TableManager, transformToRow } from './utils'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

export class BigQueryIntegration implements Integration {
  public name = 'BigQuery'
  private client: BigQuery | null = null
  private tableManager: TableManager | null = null
  private datasetId = process.env.BIGQUERY_DATASET
  private projectId = process.env.BIGQUERY_PROJECT_ID
  private autoTableManagement = process.env.BIGQUERY_AUTO_TABLE_MANAGEMENT === 'true'

  constructor() {
    if (this.isEnabled()) {
      this.client = new BigQuery()
      if (this.autoTableManagement) {
        this.tableManager = new TableManager(this.client, this.projectId!)
      }
    }
  }

  public isEnabled(): boolean {
    return !!(this.projectId && this.datasetId)
  }

  private async insert(payload: Payload, tableName: string) {
    if (!this.client || !this.datasetId) {
      return
    }

    const row = transformToRow(payload)

    if (this.tableManager) {
      // Use table manager for auto-creation and schema evolution
      const tableType = this.getTableType(tableName)
      await this.tableManager.insertWithAutoSchema(this.datasetId, tableName, tableType, [row])
    } else {
      // Direct insertion, will fail if schema is incorrect
      await this.client.dataset(this.datasetId).table(tableName).insert([row])
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
