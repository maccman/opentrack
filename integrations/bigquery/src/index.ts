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

  constructor() {
    if (this.isEnabled()) {
      this.client = new BigQuery()
      this.tableManager = new TableManager(this.client, this.projectId!)
    }
  }

  public isEnabled(): boolean {
    return !!(this.projectId && this.datasetId)
  }

  private async insert(payload: Payload, tableName: string) {
    if (!this.tableManager || !this.datasetId) {
      return
    }

    const row = transformToRow(payload)
    const tableType = this.getTableType(payload, tableName)

    // Use table manager to handle auto-creation and schema evolution
    await this.tableManager.insertWithAutoSchema(this.datasetId, tableName, tableType, [row])
  }

  private getTableType(payload: Payload, tableName: string): string {
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
    // Insert into identifies table. The `users` table is a dynamic table that is created on the fly.
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
