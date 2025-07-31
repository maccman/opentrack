import type { BigQuery, TableSchema } from '@google-cloud/bigquery'

import { CACHE_CONFIG, DATASET_CONFIG } from './constants'
import { generateSchemaFromRow, getBaseSchemaForTable, mergeSchemas } from './schema-manager'

/**
 * Utility functions for managing BigQuery tables and datasets
 */

export interface TableInfo {
  exists: boolean
  schema?: TableSchema
  needsUpdate?: boolean
}

export interface SchemaCache {
  [datasetId: string]: {
    [tableId: string]: {
      schema: TableSchema
      lastUpdated: number
    }
  }
}

interface BigQueryError {
  code: number
  errors: Array<{ reason: string }>
}

/**
 * Type guard to check if error is a BigQuery "table already exists" error
 */
function isBigQueryDuplicateError(error: unknown): error is BigQueryError {
  try {
    const err = error as BigQueryError
    return (
      err?.code === 409 && Array.isArray(err?.errors) && err.errors.length > 0 && err.errors[0]?.reason === 'duplicate'
    )
  } catch {
    return false
  }
}

/**
 * Manager class for BigQuery table and schema operations
 */
export class TableManager {
  private client: BigQuery
  private schemaCache: SchemaCache = {}
  private readonly CACHE_TTL_MS = CACHE_CONFIG.TTL_MS

  constructor(client: BigQuery, _projectId: string) {
    this.client = client
    // projectId is not currently used but kept for future features
  }

  /**
   * Ensures a dataset exists, creating it if necessary
   * @param datasetId - BigQuery dataset ID
   */
  async ensureDatasetExists(datasetId: string): Promise<void> {
    try {
      const dataset = this.client.dataset(datasetId)
      const [exists] = await dataset.exists()

      if (!exists) {
        await dataset.create({
          location: DATASET_CONFIG.LOCATION,
          metadata: {
            description: `OpenTrack analytics data for ${datasetId}`,
            labels: DATASET_CONFIG.LABELS,
          },
        })
        console.log(`Created BigQuery dataset: ${datasetId}`)
      }
    } catch (error) {
      console.error(`Failed to ensure dataset exists: ${datasetId}`, error)
      throw error
    }
  }

  /**
   * Gets information about a table including its existence and schema
   * @param datasetId - BigQuery dataset ID
   * @param tableId - BigQuery table ID
   * @returns Table information
   */
  async getTableInfo(datasetId: string, tableId: string): Promise<TableInfo> {
    try {
      // Check cache first
      const cachedSchema = this.getCachedSchema(datasetId, tableId)
      if (cachedSchema) {
        return {
          exists: true,
          schema: cachedSchema,
          needsUpdate: false,
        }
      }

      const table = this.client.dataset(datasetId).table(tableId)
      const [exists] = await table.exists()

      if (!exists) {
        return { exists: false }
      }

      const metadataResult = await table.getMetadata()
      const metadata = metadataResult[0] as { schema: TableSchema }
      const schema = metadata.schema

      // Cache the schema
      this.setCachedSchema(datasetId, tableId, schema)

      return {
        exists: true,
        schema,
        needsUpdate: false,
      }
    } catch (error) {
      console.error(`Failed to get table info: ${datasetId}.${tableId}`, error)
      throw error
    }
  }

  /**
   * Creates a new table with the appropriate schema
   * @param datasetId - BigQuery dataset ID
   * @param tableId - BigQuery table ID
   * @param tableType - Type of table (tracks, identifies, etc.)
   * @param sampleRow - Sample row to determine additional schema
   */
  async createTable(
    datasetId: string,
    tableId: string,
    tableType: string,
    sampleRow: Record<string, unknown>
  ): Promise<void> {
    // Start with base schema for this table type
    const baseSchema = getBaseSchemaForTable(tableType)

    // Generate schema from sample row
    const rowSchema = generateSchemaFromRow(sampleRow)

    // Merge schemas to get the final schema
    const { schema: finalSchema } = mergeSchemas(baseSchema, rowSchema)

    const table = this.client.dataset(datasetId).table(tableId)

    try {
      await table.create({
        schema: finalSchema,
        metadata: {
          description: `OpenTrack ${tableType} data table`,
          labels: {
            ...DATASET_CONFIG.LABELS,
            table_type: tableType,
          },
        },
      })

      // Cache the new schema
      this.setCachedSchema(datasetId, tableId, finalSchema)

      console.log(`Created BigQuery table: ${datasetId}.${tableId}`)
    } catch (error: unknown) {
      // Handle the case where table already exists (409 error)
      if (isBigQueryDuplicateError(error)) {
        console.log(`BigQuery table already exists: ${datasetId}.${tableId}`)

        // Table exists, so we should get its current schema and cache it
        try {
          const metadataResult = await table.getMetadata()
          const metadata = metadataResult[0] as { schema: TableSchema }
          this.setCachedSchema(datasetId, tableId, metadata.schema)
        } catch (metadataError) {
          console.warn(`Failed to cache schema for existing table: ${datasetId}.${tableId}`, metadataError)
        }

        return // Table exists, which is what we wanted
      }

      console.error(`Failed to create table: ${datasetId}.${tableId}`, error)
      throw error
    }
  }

  /**
   * Updates a table schema to accommodate new data
   * @param datasetId - BigQuery dataset ID
   * @param tableId - BigQuery table ID
   * @param newRow - New row data that may require schema changes
   * @param currentSchema - Current table schema
   */
  async updateTableSchema(
    datasetId: string,
    tableId: string,
    newRow: Record<string, unknown>,
    currentSchema: TableSchema
  ): Promise<boolean> {
    try {
      // Generate schema from new row
      const rowSchema = generateSchemaFromRow(newRow)

      // Merge with existing schema
      const { schema: updatedSchema, hasChanges } = mergeSchemas(currentSchema, rowSchema)

      if (!hasChanges) {
        return false // No changes needed
      }

      const table = this.client.dataset(datasetId).table(tableId)

      // Update the table schema
      await table.setMetadata({
        schema: updatedSchema,
      })

      // Update cache
      this.setCachedSchema(datasetId, tableId, updatedSchema)

      console.log(`Updated schema for table: ${datasetId}.${tableId}`)
      return true
    } catch (error) {
      console.error(`Failed to update table schema: ${datasetId}.${tableId}`, error)
      throw error
    }
  }

  /**
   * Ensures a table exists and has the correct schema for the given data
   * @param datasetId - BigQuery dataset ID
   * @param tableId - BigQuery table ID
   * @param tableType - Type of table (tracks, identifies, etc.)
   * @param sampleRow - Sample row data
   */
  async ensureTableReady(
    datasetId: string,
    tableId: string,
    tableType: string,
    sampleRow: Record<string, unknown>
  ): Promise<void> {
    // Ensure dataset exists first
    await this.ensureDatasetExists(datasetId)

    // Get table information
    const tableInfo = await this.getTableInfo(datasetId, tableId)

    if (!tableInfo.exists) {
      // Create the table
      await this.createTable(datasetId, tableId, tableType, sampleRow)
    } else if (tableInfo.schema) {
      // Update schema if needed
      await this.updateTableSchema(datasetId, tableId, sampleRow, tableInfo.schema)
    }
  }

  /**
   * Inserts data into a table, ensuring the table exists and schema is compatible
   * @param datasetId - BigQuery dataset ID
   * @param tableId - BigQuery table ID
   * @param tableType - Type of table
   * @param rows - Data rows to insert
   */
  async insertWithAutoSchema(
    datasetId: string,
    tableId: string,
    tableType: string,
    rows: Array<Record<string, unknown>>
  ): Promise<void> {
    if (rows.length === 0) {
      return
    }

    // Use first row as sample for schema
    const sampleRow = rows[0]

    // Ensure table is ready
    await this.ensureTableReady(datasetId, tableId, tableType, sampleRow)

    // Insert the data
    const table = this.client.dataset(datasetId).table(tableId)
    await table.insert(rows)
  }

  /**
   * Gets cached schema if available and not expired
   */
  private getCachedSchema(datasetId: string, tableId: string): TableSchema | null {
    const datasetCache = this.schemaCache[datasetId]
    if (!datasetCache) {
      return null
    }

    const tableCache = datasetCache[tableId]
    if (!tableCache) {
      return null
    }

    const now = Date.now()
    if (now - tableCache.lastUpdated > this.CACHE_TTL_MS) {
      // Cache expired
      delete datasetCache[tableId]
      return null
    }

    return tableCache.schema
  }

  /**
   * Sets cached schema
   */
  private setCachedSchema(datasetId: string, tableId: string, schema: TableSchema): void {
    if (!this.schemaCache[datasetId]) {
      this.schemaCache[datasetId] = {}
    }

    this.schemaCache[datasetId][tableId] = {
      schema,
      lastUpdated: Date.now(),
    }
  }

  /**
   * Clears the schema cache for a specific table or entire dataset
   */
  clearCache(datasetId?: string, tableId?: string): void {
    if (!datasetId) {
      this.schemaCache = {}
    } else if (!tableId) {
      delete this.schemaCache[datasetId]
    } else if (this.schemaCache[datasetId]) {
      delete this.schemaCache[datasetId][tableId]
    }
  }
}
