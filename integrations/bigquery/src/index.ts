import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import { BigQuery, type Table } from '@google-cloud/bigquery'

import {
  BIGQUERY_ERASURE_TRANSACTION_TABLE_LIMIT,
  buildBigQueryErasureBatchScript,
  type BigQueryErasableTable,
  getBigQueryIdentityColumns,
  isBigQueryStreamingBufferError,
  partitionBigQueryErasureTables,
} from './erasure'
import { getTableNames, TableManager, transformToRow } from './utils'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

export interface BigQueryIntegrationConfig {
  projectId: string
  datasetId: string
  autoTableManagement?: boolean
  credentials?: object
}

export interface BigQueryErasureResult {
  status: 'erased' | 'pending'
}

const ERASURE_QUERY_CONCURRENCY = 5
// Erasure batches mutate no temporary table, so all 100 transaction mutation slots can target physical event tables.
const ERASURE_MUTATION_BATCH_SIZE = BIGQUERY_ERASURE_TRANSACTION_TABLE_LIMIT

async function processInBatches<T>(items: T[], operation: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += ERASURE_QUERY_CONCURRENCY) {
    await Promise.all(items.slice(index, index + ERASURE_QUERY_CONCURRENCY).map(operation))
  }
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

    const clientConfig: { projectId: string; credentials?: object } = {
      projectId: this.config.projectId,
    }

    if (this.config.credentials) {
      clientConfig.credentials = this.config.credentials
    }

    this.client = new BigQuery(clientConfig)

    if (this.config.autoTableManagement) {
      this.tableManager = new TableManager(this.client, this.config.projectId)
    }
  }

  private async insert(payload: Payload, tableName: string) {
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

    // `tracks` is the durable retry anchor for every event-specific track row. Write it first so
    // a failed canonical insert can never leave a derivative row as the only identity link.
    if (payload.type === 'track') {
      await this.insert(payload, 'tracks')
      const eventSpecificTables = tableNames.filter((tableName) => tableName !== 'tracks')
      await Promise.all(eventSpecificTables.map((tableName) => this.insert(payload, tableName)))
      return
    }

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

  private async getErasableTables(): Promise<BigQueryErasableTable[]> {
    const [tables] = await this.client.dataset(this.config.datasetId).getTables({ autoPaginate: true })
    const erasableTables: BigQueryErasableTable[] = []

    await processInBatches(tables, async (table: Table) => {
      const metadataResponse: unknown = await table.getMetadata()
      if (!Array.isArray(metadataResponse)) {
        throw new TypeError('BigQuery returned invalid table metadata')
      }
      const metadata: unknown = metadataResponse[0]
      if (!metadata || typeof metadata !== 'object') {
        throw new TypeError('BigQuery returned invalid table metadata')
      }
      if (!('type' in metadata) || typeof metadata.type !== 'string') {
        throw new TypeError('BigQuery returned table metadata without a type')
      }
      if (metadata.type !== 'TABLE') {
        return
      }
      if (!table.id) {
        throw new TypeError('BigQuery returned a physical table without an identifier')
      }

      const schema = 'schema' in metadata ? metadata.schema : undefined
      if (!schema || typeof schema !== 'object' || Array.isArray(schema) || !('fields' in schema)) {
        throw new TypeError(`BigQuery table ${table.id} returned invalid schema metadata`)
      }
      const fields = schema.fields
      const identityColumns = getBigQueryIdentityColumns(table.id, fields)

      if (identityColumns.length > 0) {
        erasableTables.push({ tableId: table.id, identityColumns })
      }
    })

    return erasableTables.sort((left, right) => left.tableId.localeCompare(right.tableId))
  }

  /** Deletes one rooted identity across retry-safe batches while preserving canonical anchors until last. */
  public async eraseUser(userId: string): Promise<BigQueryErasureResult> {
    const tables = await this.getErasableTables()
    if (tables.length === 0) {
      return { status: 'erased' }
    }

    const { canonicalTables, eventSpecificTables } = partitionBigQueryErasureTables(tables)
    const eventSpecificBatches: BigQueryErasableTable[][] = []
    for (let index = 0; index < eventSpecificTables.length; index += ERASURE_MUTATION_BATCH_SIZE) {
      eventSpecificBatches.push(eventSpecificTables.slice(index, index + ERASURE_MUTATION_BATCH_SIZE))
    }

    // Build every script before the first mutation. Unsafe identifiers or invalid plans therefore
    // fail closed without partially erasing event-specific data.
    const queries = eventSpecificBatches.map((mutationTables) =>
      buildBigQueryErasureBatchScript({
        projectId: this.config.projectId,
        datasetId: this.config.datasetId,
        canonicalTables,
        mutationTables,
      })
    )
    if (canonicalTables.length > 0) {
      queries.push(
        buildBigQueryErasureBatchScript({
          projectId: this.config.projectId,
          datasetId: this.config.datasetId,
          canonicalTables,
          mutationTables: canonicalTables,
        })
      )
    }

    for (const query of queries) {
      try {
        await this.client.query({
          query,
          params: { userId },
          types: { userId: 'STRING' },
        })
      } catch (error) {
        if (isBigQueryStreamingBufferError(error)) {
          return { status: 'pending' }
        }
        throw error
      }
    }

    return { status: 'erased' }
  }
}
