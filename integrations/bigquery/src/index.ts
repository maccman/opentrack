import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import { BigQuery } from '@google-cloud/bigquery'
import { getTableNames, transformToRow } from './utils'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

export class BigQueryIntegration implements Integration {
  public name = 'BigQuery'
  private client: BigQuery | null = null
  private datasetId = process.env.BIGQUERY_DATASET

  constructor() {
    if (this.isEnabled()) {
      this.client = new BigQuery()
    }
  }

  public isEnabled(): boolean {
    return !!(process.env.BIGQUERY_PROJECT_ID && this.datasetId)
  }

  private async insert(payload: Payload, tableName: string) {
    if (!this.client) {
      return
    }

    const row = transformToRow(payload)
    await this.client.dataset(this.datasetId!).table(tableName).insert([row])
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
