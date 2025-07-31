import type { BigQuery, Dataset, Table, TableSchema } from '@google-cloud/bigquery'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TableManager } from '../table-manager'

// Mock BigQuery types
function createMockTable(exists = false, schema?: TableSchema) {
  return {
    exists: vi.fn().mockResolvedValue([exists]),
    getMetadata: vi.fn().mockResolvedValue([{ schema }]),
    create: vi.fn().mockResolvedValue(undefined),
    setMetadata: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockDataset(exists = false) {
  return {
    exists: vi.fn().mockResolvedValue([exists]),
    create: vi.fn().mockResolvedValue(undefined),
    table: vi.fn(),
  }
}

function createMockBigQuery() {
  return {
    dataset: vi.fn(),
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
    ;(mockBigQuery.dataset as ReturnType<typeof vi.fn>).mockReturnValue(mockDataset)
    ;(mockDataset.table as ReturnType<typeof vi.fn>).mockReturnValue(mockTable)

    tableManager = new TableManager(mockBigQuery, 'test-project')
  })

  describe('ensureDatasetExists', () => {
    it('should create dataset if it does not exist', async () => {
      // Dataset doesn't exist
      ;(mockDataset.exists as ReturnType<typeof vi.fn>).mockResolvedValue([false])

      await tableManager.ensureDatasetExists('test-dataset')

      expect(mockBigQuery.dataset).toHaveBeenCalledWith('test-dataset')
      expect(mockDataset.exists).toHaveBeenCalled()
      expect(mockDataset.create).toHaveBeenCalledWith({
        location: 'US',
        metadata: {
          description: 'Libroseg analytics data for test-dataset',
          labels: {
            created_by: 'libroseg',
            source: 'segment_integration',
          },
        },
      })
    })

    it('should not create dataset if it already exists', async () => {
      // Dataset exists
      ;(mockDataset.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])

      await tableManager.ensureDatasetExists('test-dataset')

      expect(mockBigQuery.dataset).toHaveBeenCalledWith('test-dataset')
      expect(mockDataset.exists).toHaveBeenCalled()
      expect(mockDataset.create).not.toHaveBeenCalled()
    })
  })

  describe('getTableInfo', () => {
    it('should return table info when table exists', async () => {
      const mockSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      // Table exists
      ;(mockTable.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])
      ;(mockTable.getMetadata as ReturnType<typeof vi.fn>).mockResolvedValue([{ schema: mockSchema }])

      const tableInfo = await tableManager.getTableInfo('test-dataset', 'test-table')

      expect(tableInfo.exists).toBe(true)
      expect(tableInfo.schema).toEqual(mockSchema)
      expect(mockDataset.table).toHaveBeenCalledWith('test-table')
      expect(mockTable.exists).toHaveBeenCalled()
      expect(mockTable.getMetadata).toHaveBeenCalled()
    })

    it('should return non-existent info when table does not exist', async () => {
      // Table doesn't exist
      ;(mockTable.exists as ReturnType<typeof vi.fn>).mockResolvedValue([false])

      const tableInfo = await tableManager.getTableInfo('test-dataset', 'test-table')

      expect(tableInfo.exists).toBe(false)
      expect(tableInfo.schema).toBeUndefined()
      expect(mockTable.getMetadata).not.toHaveBeenCalled()
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

      expect(mockDataset.table).toHaveBeenCalledWith('test-table')
      expect(mockTable.create).toHaveBeenCalled()

      const createCall = (mockTable.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(createCall.schema).toBeDefined()
      expect(createCall.schema.fields).toBeDefined()
      expect(createCall.metadata.description).toBe('Libroseg tracks data table')
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
      expect(mockTable.setMetadata).toHaveBeenCalled()

      const setMetadataCall = (mockTable.setMetadata as ReturnType<typeof vi.fn>).mock.calls[0][0]
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
      expect(mockTable.setMetadata).not.toHaveBeenCalled()
    })
  })

  describe('ensureTableReady', () => {
    it('should create table when it does not exist', async () => {
      // Dataset exists, table doesn't
      ;(mockDataset.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])
      ;(mockTable.exists as ReturnType<typeof vi.fn>).mockResolvedValue([false])

      const sampleRow = { id: 'test', event: 'Test Event' }

      await tableManager.ensureTableReady('test-dataset', 'test-table', 'tracks', sampleRow)

      expect(mockDataset.exists).toHaveBeenCalled()
      expect(mockTable.exists).toHaveBeenCalled()
      expect(mockTable.create).toHaveBeenCalled()
    })

    it('should update schema when table exists but schema needs updating', async () => {
      const existingSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      // Dataset and table exist
      ;(mockDataset.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])
      ;(mockTable.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])
      ;(mockTable.getMetadata as ReturnType<typeof vi.fn>).mockResolvedValue([{ schema: existingSchema }])

      const sampleRow = { id: 'test', new_field: 'new' } // Has new field

      await tableManager.ensureTableReady('test-dataset', 'test-table', 'tracks', sampleRow)

      expect(mockDataset.exists).toHaveBeenCalled()
      expect(mockTable.exists).toHaveBeenCalled()
      expect(mockTable.getMetadata).toHaveBeenCalled()
      expect(mockTable.setMetadata).toHaveBeenCalled()
    })
  })

  describe('insertWithAutoSchema', () => {
    it('should handle table creation and data insertion', async () => {
      // Dataset exists, table doesn't
      ;(mockDataset.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])
      ;(mockTable.exists as ReturnType<typeof vi.fn>).mockResolvedValue([false])

      const rows = [
        { id: 'test1', event: 'Test Event' },
        { id: 'test2', event: 'Another Event' },
      ]

      await tableManager.insertWithAutoSchema('test-dataset', 'test-table', 'tracks', rows)

      expect(mockTable.create).toHaveBeenCalled()
      expect(mockTable.insert).toHaveBeenCalledWith(rows)
    })

    it('should handle empty rows array', async () => {
      await tableManager.insertWithAutoSchema('test-dataset', 'test-table', 'tracks', [])

      // Should not make any BigQuery calls
      expect(mockDataset.exists).not.toHaveBeenCalled()
      expect(mockTable.exists).not.toHaveBeenCalled()
      expect(mockTable.insert).not.toHaveBeenCalled()
    })
  })

  describe('caching', () => {
    it('should cache schema after first retrieval', async () => {
      const mockSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      ;(mockTable.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])
      ;(mockTable.getMetadata as ReturnType<typeof vi.fn>).mockResolvedValue([{ schema: mockSchema }])

      // First call
      const tableInfo1 = await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(tableInfo1.schema).toEqual(mockSchema)
      expect(mockTable.getMetadata).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const tableInfo2 = await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(tableInfo2.schema).toEqual(mockSchema)
      expect(mockTable.getMetadata).toHaveBeenCalledTimes(1) // Still only 1 call
    })

    it('should clear cache when requested', async () => {
      const mockSchema: TableSchema = {
        fields: [{ name: 'id', type: 'STRING', mode: 'REQUIRED' }],
      }

      ;(mockTable.exists as ReturnType<typeof vi.fn>).mockResolvedValue([true])
      ;(mockTable.getMetadata as ReturnType<typeof vi.fn>).mockResolvedValue([{ schema: mockSchema }])

      // First call to populate cache
      await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(mockTable.getMetadata).toHaveBeenCalledTimes(1)

      // Clear cache
      tableManager.clearCache('test-dataset', 'test-table')

      // Next call should hit the API again
      await tableManager.getTableInfo('test-dataset', 'test-table')
      expect(mockTable.getMetadata).toHaveBeenCalledTimes(2)
    })
  })
})
