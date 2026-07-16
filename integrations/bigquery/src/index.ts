import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import { BigQuery, type Table } from '@google-cloud/bigquery'

import {
  buildAnonymousIdDiscoveryQuery,
  buildDeleteStatement,
  type DeletableTable,
  getDeletionIdentityColumns,
  isOpenTrackTable,
  isStreamingBufferError,
  orderTablesForDeletion,
} from './deletion'
import { getTableNames, TableManager, transformToRow } from './utils'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

export interface BigQueryIntegrationConfig {
  projectId: string
  datasetId: string
  autoTableManagement?: boolean
  credentials?: object
}

/**
 * Outcome of one deletion attempt.
 *
 * `RUNNING` mirrors Segment's regulation status: rows still in the streaming
 * buffer cannot be deleted yet, so the caller must retry once the buffer drains.
 */
export interface BigQueryDeletionResult {
  status: 'FINISHED' | 'RUNNING'
  /** Dataset tables skipped because they are not OpenTrack-shaped. */
  skippedTables: string[]
}

const METADATA_FETCH_CONCURRENCY = 5
const DELETE_CONCURRENCY = 5

async function forEachWithConcurrency<T>(items: T[], limit: number, operation: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += limit) {
    await Promise.all(items.slice(index, index + limit).map(operation))
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

    // `tracks` is the identity anchor deletion relies on to discover a user's
    // anonymous ids. Write it before event-specific rows so a partial failure
    // can never leave an event row whose identifiers `tracks` doesn't know.
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

  /** Lists OpenTrack-shaped physical tables; everything else in the dataset is reported as skipped. */
  private async getDeletableTables(): Promise<{ tables: DeletableTable[]; skippedTables: string[] }> {
    const [datasetTables] = await this.client.dataset(this.config.datasetId).getTables({ autoPaginate: true })
    const tables: DeletableTable[] = []
    const skippedTables: string[] = []

    await forEachWithConcurrency(datasetTables, METADATA_FETCH_CONCURRENCY, async (table: Table) => {
      const tableId = table.id
      if (!tableId) {
        throw new TypeError('BigQuery returned a table without an identifier')
      }

      const metadataResponse: unknown = await table.getMetadata()
      const metadata: unknown = Array.isArray(metadataResponse) ? metadataResponse[0] : null
      if (!metadata || typeof metadata !== 'object') {
        throw new TypeError(`BigQuery returned invalid metadata for table ${tableId}`)
      }

      const type = 'type' in metadata && typeof metadata.type === 'string' ? metadata.type : null
      if (type !== 'TABLE') {
        // Views, materialized views, external tables, and snapshots hold no rows of their own.
        return
      }

      const schema = 'schema' in metadata ? metadata.schema : null
      const fields = schema && typeof schema === 'object' && 'fields' in schema ? schema.fields : null

      if (!isOpenTrackTable(tableId, fields)) {
        skippedTables.push(tableId)
        return
      }

      const identityColumns = getDeletionIdentityColumns(tableId, fields)
      if (identityColumns.length === 0) {
        skippedTables.push(tableId)
        return
      }

      tables.push({ tableId, identityColumns })
    })

    return { tables, skippedTables: skippedTables.sort() }
  }

  private async runDelete(
    statement: string,
    subjectIds: string[],
    anonymousIds: string[]
  ): Promise<'done' | 'buffered'> {
    try {
      await this.client.query({
        query: statement,
        params: { subjectIds, anonymousIds },
        types: { subjectIds: ['STRING'], anonymousIds: ['STRING'] },
      })
      return 'done'
    } catch (error) {
      if (isStreamingBufferError(error)) {
        return 'buffered'
      }
      throw error
    }
  }

  /**
   * Deletes every row currently held for the requested user ids.
   *
   * Matches rows by trusted `user_id`, by anonymous ids directly observed on that
   * user's canonical rows, and by `previous_id` equal to a requested id. Event
   * tables are deleted before canonical tables (`tracks` last) so a deferred or
   * failed run always leaves the identity anchors a retry needs.
   */
  public async deleteUsers(subjectIds: string[]): Promise<BigQueryDeletionResult> {
    const { tables, skippedTables } = await this.getDeletableTables()
    if (tables.length === 0) {
      return { status: 'FINISHED', skippedTables }
    }

    const discoveryQuery = buildAnonymousIdDiscoveryQuery(this.config.projectId, this.config.datasetId, tables)
    let discoveredAnonymousIds: string[] = []
    if (discoveryQuery) {
      const [rows] = await this.client.query({
        query: discoveryQuery,
        params: { subjectIds },
        types: { subjectIds: ['STRING'] },
      })
      discoveredAnonymousIds = (rows as { anonymous_id: string }[]).map((row) => row.anonymous_id)
    }
    const anonymousIds = [...new Set([...subjectIds, ...discoveredAnonymousIds])]

    // Build every statement before the first mutation so an invalid identifier
    // fails the whole run without deleting anything.
    const { eventTables, canonicalTables } = orderTablesForDeletion(tables)
    const eventStatements = eventTables.map((table) =>
      buildDeleteStatement(this.config.projectId, this.config.datasetId, table)
    )
    const canonicalStatements = canonicalTables.map((table) =>
      buildDeleteStatement(this.config.projectId, this.config.datasetId, table)
    )

    let deferred = false
    await forEachWithConcurrency(eventStatements, DELETE_CONCURRENCY, async (statement) => {
      if ((await this.runDelete(statement, subjectIds, anonymousIds)) === 'buffered') {
        deferred = true
      }
    })
    if (deferred) {
      // Leave every canonical anchor in place; the retry rediscovers the same ids.
      return { status: 'RUNNING', skippedTables }
    }

    // Canonical tables go sequentially in anchor order so a streaming-buffer
    // deferral keeps `identifies`/`tracks` (the discovery sources) intact.
    for (const statement of canonicalStatements) {
      if ((await this.runDelete(statement, subjectIds, anonymousIds)) === 'buffered') {
        return { status: 'RUNNING', skippedTables }
      }
    }

    return { status: 'FINISHED', skippedTables }
  }
}
