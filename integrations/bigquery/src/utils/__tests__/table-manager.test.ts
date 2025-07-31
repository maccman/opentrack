import type { BigQuery, Dataset, Table, TableSchema } from '@google-cloud/bigquery'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TableManager } from '../table-manager'

// Mock spy functions
const datasetSpy = vi.fn()
const datasetExistsSpy = vi.fn()
const datasetCreateSpy = vi.fn()
const datasetTableSpy = vi.fn()
const tableExistsSpy = vi.fn()
const tableGetMetadataSpy = vi.fn()
const tableCreateSpy = vi.fn()
const tableSetMetadataSpy = vi.fn()
const tableInsertSpy = vi.fn()

// Mock BigQuery types
function createMockTable(exists = false, schema?: TableSchema) {
  return {
    exists: tableExistsSpy.mockResolvedValue([exists]),
    getMetadata: tableGetMetadataSpy.mockResolvedValue([{ schema }]),
    create: tableCreateSpy.mockResolvedValue(undefined),
    setMetadata: tableSetMetadataSpy.mockResolvedValue(undefined),
    insert: tableInsertSpy.mockResolvedValue(undefined),
  }
}

function createMockDataset(exists = false) {
  return {
    exists: datasetExistsSpy.mockResolvedValue([exists]),
    create: datasetCreateSpy.mockResolvedValue(undefined),
    table: datasetTableSpy,
  }
}

function createMockBigQuery() {
  return {
    dataset: datasetSpy,
  }
}

describe('TableManager', () => {
  let mockBigQuery: BigQuery
  let mockDataset: Dataset
  let mockTable: Table
  let tableManager: TableManager

  beforeEach(() => {
    vi.clearAllMocks()

    mockTable = createMockTable() as unknown as Table
    mockDataset = createMockDataset() as unknown as Dataset
    mockBigQuery = createMockBigQuery() as unknown as BigQuery

    // Setup the chain: bigquery.dataset().table()
    datasetSpy.mockReturnValue(mockDataset)
    datasetTableSpy.mockReturnValue(mockTable)

    tableManager = new TableManager(mockBigQuery, 'test-project')
  })

  describe('ensureDatasetExists', () => {
    it('should create dataset if it does not exist', async () => {
      // Dataset doesn't exist
      datasetExistsSpy.mockResolvedValue([false])

      await tableManager.ensureDatasetExists('test-dataset')

      expect(datasetSpy).toHaveBeenCalledWith('test-dataset')
      expect(datasetExistsSpy).toHaveBeenCalled()
      expect(datasetCreateSpy).toHaveBeenCalledWith({
        location: 'US',
        metadata: {
          description: 'OpenTrack analytics data for test-dataset',
          labels: {
            created_by: 'opentrack',
            source: 'segment_integration',
          },
        },
      })
    })

    it('should not create dataset if it already exists', async () => {
      // Dataset exists
      datasetExistsSpy.mockResolvedValue([true])

      await tableManager.ensureDatasetExists('test-dataset')

      expect(datasetSpy).toHaveBeenCalledWith('test-dataset')
      expect(datasetExistsSpy).toHaveBeenCalled()
      expect(datasetCreateSpy).not.toHaveBeenCalled()
    })
  })

  describe('getTableInfo', () => {
    it('should return table info when table exists', async () => {
      const mockSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      // Table exists
      tableExistsSpy.mockResolvedValue([true])
      tableGetMetadataSpy.mockResolvedValue([{ schema: mockSchema }])

      const tableInfo = await tableManager.getTableInfo('test-dataset', 'test-table')

      expect(tableInfo.exists).toBe(true)
      expect(tableInfo.schema).toEqual(mockSchema)
      expect(datasetTableSpy).toHaveBeenCalledWith('test-table')
      expect(tableExistsSpy).toHaveBeenCalled()
      expect(tableGetMetadataSpy).toHaveBeenCalled()
    })

    it('should return non-existent info when table does not exist', async () => {
      // Table doesn't exist
      tableExistsSpy.mockResolvedValue([false])

      const tableInfo = await tableManager.getTableInfo('test-dataset', 'test-table')

      expect(tableInfo.exists).toBe(false)
      expect(tableInfo.schema).toBeUndefined()
      expect(tableGetMetadataSpy).not.toHaveBeenCalled()
    })
  })

  describe('createTable', () => {
    it('should create table with merged schema', async () => {
      const sampleRow = {
        id: 'test-123',
        event: 'Test Event',
        properties: { key: 'value' },
      }

      await tableManager.createTable('test-dataset', 'test-table', 'tracks', sampleRow)

      expect(datasetTableSpy).toHaveBeenCalledWith('test-table')
      expect(tableCreateSpy).toHaveBeenCalled()

      const createCall = tableCreateSpy.mock.calls[0][0] as {
        schema: { fields: unknown[] }
        metadata: { description: string; labels: { table_type: string } }
      }
      expect(createCall.schema).toBeDefined()
      expect(createCall.schema.fields).toBeDefined()
      expect(createCall.metadata.description).toBe('OpenTrack tracks data table')
      expect(createCall.metadata.labels.table_type).toBe('tracks')
    })
  })

  describe('updateTableSchema', () => {
    it('should update schema when changes are needed', async () => {
      const currentSchema: TableSchema = {
        fields: [
          { name: 'id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'count', type: 'INTEGER', mode: 'NULLABLE' },
        ],
      }

      const newRow = {
        id: 'test-123',
        count: 42,
        new_field: 'new_value', // This will require schema update
      }

      const updated = await tableManager.updateTableSchema('test-dataset', 'test-table', newRow, currentSchema)

      expect(updated).toBe(true)
      expect(tableSetMetadataSpy).toHaveBeenCalled()

      const setMetadataCall = tableSetMetadataSpy.mock.calls[0][0] as {
        schema: { fields: unknown[] }
      }
      expect(setMetadataCall.schema.fields).toHaveLength(3)
    })

    it('should not update schema when no changes are needed', async () => {
      const currentSchema: TableSchema = {
        fields: [
          { name: 'id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'count', type: 'INTEGER', mode: 'NULLABLE' },
        ],
      }

      const newRow = {
        id: 'test-123',
        count: 42, // Same fields, no new data
      }

      const updated = await tableManager.updateTableSchema('test-dataset', 'test-table', newRow, currentSchema)

      expect(updated).toBe(false)
      expect(tableSetMetadataSpy).not.toHaveBeenCalled()
    })
  })

  describe('ensureTableReady', () => {
    it('should create table when it does not exist', async () => {
      // Dataset exists, table doesn't
      datasetExistsSpy.mockResolvedValue([true])
      tableExistsSpy.mockResolvedValue([false])

      const sampleRow = { id: 'test', event: 'Test Event' }

      await tableManager.ensureTableReady('test-dataset', 'test-table', 'tracks', sampleRow)

      expect(datasetExistsSpy).toHaveBeenCalled()
      expect(tableExistsSpy).toHaveBeenCalled()
      expect(tableCreateSpy).toHaveBeenCalled()
    })

    it('should update schema when table exists but schema needs updating', async () => {
      const existingSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      // Dataset and table exist
      datasetExistsSpy.mockResolvedValue([true])
      tableExistsSpy.mockResolvedValue([true])
      tableGetMetadataSpy.mockResolvedValue([{ schema: existingSchema }])

      const sampleRow = { id: 'test', new_field: 'new' } // Has new field

      await tableManager.ensureTableReady('test-dataset', 'test-table', 'tracks', sampleRow)

      expect(datasetExistsSpy).toHaveBeenCalled()
      expect(tableExistsSpy).toHaveBeenCalled()
      expect(tableGetMetadataSpy).toHaveBeenCalled()
      expect(tableSetMetadataSpy).toHaveBeenCalled()
    })
  })

  describe('insertWithAutoSchema', () => {
    it('should handle table creation and data insertion', async () => {
      // Dataset exists, table doesn't
      datasetExistsSpy.mockResolvedValue([true])
      tableExistsSpy.mockResolvedValue([false])

      const rows = [
        { id: 'test1', event: 'Test Event' },
        { id: 'test2', event: 'Another Event' },
      ]

      await tableManager.insertWithAutoSchema('test-dataset', 'test-table', 'tracks', rows)

      expect(tableCreateSpy).toHaveBeenCalled()
      expect(tableInsertSpy).toHaveBeenCalledWith(rows)
    })

    it('should handle empty rows array', async () => {
      await tableManager.insertWithAutoSchema('test-dataset', 'test-table', 'tracks', [])

      // Should not make any BigQuery calls
      expect(datasetExistsSpy).not.toHaveBeenCalled()
      expect(tableExistsSpy).not.toHaveBeenCalled()
      expect(tableInsertSpy).not.toHaveBeenCalled()
    })
  })

  describe('caching', () => {
    it('should cache schema after first retrieval', async () => {
      const mockSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      tableExistsSpy.mockResolvedValue([true])
      tableGetMetadataSpy.mockResolvedValue([{ schema: mockSchema }])

      // First call
      const tableInfo1 = await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(tableInfo1.schema).toEqual(mockSchema)
      expect(tableGetMetadataSpy).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const tableInfo2 = await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(tableInfo2.schema).toEqual(mockSchema)
      expect(tableGetMetadataSpy).toHaveBeenCalledTimes(1) // Still only 1 call
    })

    it('should clear cache when requested', async () => {
      const mockSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      tableExistsSpy.mockResolvedValue([true])
      tableGetMetadataSpy.mockResolvedValue([{ schema: mockSchema }])

      // First call to populate cache
      await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(tableGetMetadataSpy).toHaveBeenCalledTimes(1)

      // Clear cache
      tableManager.clearCache('test-dataset', 'test-table')

      // Next call should hit the API again
      await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(tableGetMetadataSpy).toHaveBeenCalledTimes(2)
    })
  })
})
