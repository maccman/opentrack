import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import { BigQuery, type Table } from '@google-cloud/bigquery'

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
  remainingRows: number
  pendingTableCount: number
}

interface ErasableTable {
  tableId: string
  predicates: string[]
}

const ERASURE_QUERY_CONCURRENCY = 5

function quoteTablePath(projectId: string, datasetId: string, tableId: string): string {
  if (!/^[a-z][\da-z-]{4,61}[\da-z]$/.test(projectId)) {
    throw new Error('Invalid BigQuery project identifier')
  }
  if (!/^\w+$/.test(datasetId) || !/^\w+$/.test(tableId)) {
    throw new Error('Invalid BigQuery dataset or table identifier')
  }
  return `\`${projectId}.${datasetId}.${tableId}\``
}

function isLegacyStreamingBufferError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('streaming buffer')
}

function parseCountRow(row: unknown): number {
  if (!row || typeof row !== 'object' || !('count' in row)) {
    throw new Error('BigQuery erasure verification returned an invalid count')
  }

  const count = row.count
  if (typeof count === 'object' && count && 'value' in count) {
    return Number(count.value)
  }
  return Number(count)
}

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

  private async getErasableTables(): Promise<ErasableTable[]> {
    const [tables] = await this.client.dataset(this.config.datasetId).getTables({ autoPaginate: true })
    const erasableTables: ErasableTable[] = []

    await processInBatches(tables, async (table: Table) => {
      const metadataResponse: unknown = await table.getMetadata()
      if (!Array.isArray(metadataResponse)) {
        throw new TypeError('BigQuery returned invalid table metadata')
      }
      const metadata: unknown = metadataResponse[0]
      if (!metadata || typeof metadata !== 'object') {
        throw new TypeError('BigQuery returned invalid table metadata')
      }
      if (!('type' in metadata) || metadata.type !== 'TABLE' || !table.id) {
        return
      }

      const schema = 'schema' in metadata ? metadata.schema : undefined
      const fields: unknown[] =
        schema && typeof schema === 'object' && !Array.isArray(schema) && 'fields' in schema
          ? Array.isArray(schema.fields)
            ? schema.fields
            : []
          : Array.isArray(schema)
            ? schema
            : []
      const columnNames = new Set(
        fields.flatMap((field) =>
          field && typeof field === 'object' && 'name' in field && typeof field.name === 'string' ? [field.name] : []
        )
      )
      const predicates = [
        columnNames.has('user_id') ? 'user_id = @userId' : null,
        columnNames.has('anonymous_id') ? 'anonymous_id = @userId' : null,
        columnNames.has('previous_id') ? 'previous_id = @userId' : null,
      ].filter((predicate): predicate is string => predicate !== null)

      if (predicates.length > 0) {
        erasableTables.push({ tableId: table.id, predicates })
      }
    })

    return erasableTables.sort((left, right) => left.tableId.localeCompare(right.tableId))
  }

  /** Deletes and verifies rows that currently bear this identifier. */
  public async eraseUser(userId: string): Promise<BigQueryErasureResult> {
    const tables = await this.getErasableTables()
    const streamingBlockedTables = new Set<string>()

    await processInBatches(tables, async ({ tableId, predicates }) => {
      const tablePath = quoteTablePath(this.config.projectId, this.config.datasetId, tableId)
      try {
        await this.client.query({
          query: `DELETE FROM ${tablePath} WHERE ${predicates.join(' OR ')}`,
          params: { userId },
          types: { userId: 'STRING' },
        })
      } catch (error) {
        if (isLegacyStreamingBufferError(error)) {
          streamingBlockedTables.add(tableId)
          return
        }
        throw error
      }
    })

    let remainingRows = 0
    const tablesWithRemainingRows = new Set<string>()
    await processInBatches(tables, async ({ tableId, predicates }) => {
      const tablePath = quoteTablePath(this.config.projectId, this.config.datasetId, tableId)
      const [rows] = await this.client.query({
        query: `SELECT COUNT(1) AS count FROM ${tablePath} WHERE ${predicates.join(' OR ')}`,
        params: { userId },
        types: { userId: 'STRING' },
      })
      const count = parseCountRow(rows[0])
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error('BigQuery erasure verification returned an invalid count')
      }
      remainingRows += count
      if (count > 0) {
        tablesWithRemainingRows.add(tableId)
      }
    })

    const pendingTableCount = new Set([...streamingBlockedTables, ...tablesWithRemainingRows]).size
    return {
      status: pendingTableCount === 0 && remainingRows === 0 ? 'erased' : 'pending',
      remainingRows,
      pendingTableCount,
    }
  }
}
