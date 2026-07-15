/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import type { Logger } from 'pino'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IntegrationManager } from '../integrations/manager'

// Mock integrations for testing
class MockSuccessfulIntegration implements Integration {
  name = 'MockSuccessful'

  track(_payload: TrackPayload): Promise<void> {
    // Simulate successful operation
    return Promise.resolve()
  }

  identify(_payload: IdentifyPayload): Promise<void> {
    // Simulate successful operation
    return Promise.resolve()
  }

  page(_payload: PagePayload): Promise<void> {
    // Simulate successful operation
    return Promise.resolve()
  }

  group(_payload: GroupPayload): Promise<void> {
    // Simulate successful operation
    return Promise.resolve()
  }

  alias(_payload: AliasPayload): Promise<void> {
    // Simulate successful operation
    return Promise.resolve()
  }
}

class MockFailingIntegration implements Integration {
  name = 'MockFailing'

  track(_payload: TrackPayload): Promise<void> {
    return Promise.reject(new Error('Track operation failed'))
  }

  identify(_payload: IdentifyPayload): Promise<void> {
    return Promise.reject(new Error('Identify operation failed'))
  }

  page(_payload: PagePayload): Promise<void> {
    return Promise.reject(new Error('Page operation failed'))
  }

  group(_payload: GroupPayload): Promise<void> {
    return Promise.reject(new Error('Group operation failed'))
  }

  alias(_payload: AliasPayload): Promise<void> {
    return Promise.reject(new Error('Alias operation failed'))
  }
}

class MockSlowIntegration implements Integration {
  name = 'MockSlow'

  async track(_payload: TrackPayload): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  async identify(_payload: IdentifyPayload): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  async page(_payload: PagePayload): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  async group(_payload: GroupPayload): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  async alias(_payload: AliasPayload): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

// Mock logger
function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(),
    level: 'info',
    levelVal: 30,
    version: '1.0.0',
    bindings: vi.fn(),
    serializers: {},
  } as unknown as Logger
}

// Sample payloads for testing
function createTrackPayload(): TrackPayload {
  return {
    type: 'track',
    event: 'Test Event',
    userId: 'user123',
    anonymousId: 'anon123',
    properties: { test: 'value' },
    timestamp: new Date().toISOString(),
  }
}

function createIdentifyPayload(): IdentifyPayload {
  return {
    type: 'identify',
    userId: 'user123',
    traits: { name: 'John Doe', email: 'john@example.com' },
    timestamp: new Date().toISOString(),
  }
}

function createPagePayload(): PagePayload {
  return {
    type: 'page',
    userId: 'user123',
    name: 'Test Page',
    properties: { url: 'https://example.com/test' },
    timestamp: new Date().toISOString(),
  }
}

function createGroupPayload(): GroupPayload {
  return {
    type: 'group',
    userId: 'user123',
    groupId: 'group123',
    traits: { name: 'Test Group' },
    timestamp: new Date().toISOString(),
  }
}

function createAliasPayload(): AliasPayload {
  return {
    type: 'alias',
    userId: 'user123',
    previousId: 'old_user_id',
    timestamp: new Date().toISOString(),
  }
}

describe('IntegrationManager', () => {
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = createMockLogger()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create an instance with integrations', () => {
      const integrations = [new MockSuccessfulIntegration()]
      const manager = new IntegrationManager(integrations)

      expect(manager).toBeInstanceOf(IntegrationManager)
    })

    it('should create an instance without logger when not configured', () => {
      const integrations = [new MockSuccessfulIntegration()]
      const manager = new IntegrationManager(integrations)

      expect(manager).toBeInstanceOf(IntegrationManager)
    })

    it('should create an instance with logger when enabled', () => {
      const integrations = [new MockSuccessfulIntegration()]
      const manager = new IntegrationManager(integrations, {
        enabled: true,
        logger: mockLogger,
      })

      expect(manager).toBeInstanceOf(IntegrationManager)
    })

    it('should create an instance with default logger when enabled but no logger provided', () => {
      const integrations = [new MockSuccessfulIntegration()]
      const manager = new IntegrationManager(integrations, { enabled: true })

      expect(manager).toBeInstanceOf(IntegrationManager)
    })
  })

  describe('process', () => {
    describe('successful processing', () => {
      it('should process track event successfully', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          integrationName: 'MockSuccessfulIntegration',
          success: true,
          duration: expect.any(Number),
        })
        expect(results[0].error).toBeUndefined()
      })

      it('should process identify event successfully', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createIdentifyPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          integrationName: 'MockSuccessfulIntegration',
          success: true,
          duration: expect.any(Number),
        })
      })

      it('should process page event successfully', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createPagePayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          integrationName: 'MockSuccessfulIntegration',
          success: true,
          duration: expect.any(Number),
        })
      })

      it('should process group event successfully', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createGroupPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          integrationName: 'MockSuccessfulIntegration',
          success: true,
          duration: expect.any(Number),
        })
      })

      it('should process alias event successfully', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createAliasPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          integrationName: 'MockSuccessfulIntegration',
          success: true,
          duration: expect.any(Number),
        })
      })

      it('should process multiple integrations successfully', async () => {
        const integrations = [new MockSuccessfulIntegration(), new MockSlowIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(2)
        expect(results.every((r) => r.success)).toBe(true)
        expect(results.map((r) => r.integrationName)).toEqual(['MockSuccessfulIntegration', 'MockSlowIntegration'])
      })
    })

    describe('error handling', () => {
      it('should handle integration failure gracefully', async () => {
        const integrations = [new MockFailingIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          integrationName: 'MockFailingIntegration',
          success: false,
          duration: expect.any(Number),
          error: expect.any(Error),
        })
        expect(results[0].error?.message).toBe('Track operation failed')
      })

      it('should handle mixed success and failure', async () => {
        const integrations = [new MockSuccessfulIntegration(), new MockFailingIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(2)
        expect(results[0].success).toBe(true)
        expect(results[1].success).toBe(false)
        expect(results[1].error?.message).toBe('Track operation failed')
      })

      it('should handle non-Error exceptions', async () => {
        class ThrowingIntegration implements Integration {
          name = 'ThrowingIntegration'

          track(_payload: TrackPayload): Promise<void> {
            return Promise.reject(new Error('String error'))
          }

          identify(_payload: IdentifyPayload): Promise<void> {
            return Promise.resolve()
          }

          page(_payload: PagePayload): Promise<void> {
            return Promise.resolve()
          }

          group(_payload: GroupPayload): Promise<void> {
            return Promise.resolve()
          }

          alias(_payload: AliasPayload): Promise<void> {
            return Promise.resolve()
          }
        }

        const integrations = [new ThrowingIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          integrationName: 'ThrowingIntegration',
          success: false,
          duration: expect.any(Number),
          error: expect.any(Error),
        })
        expect(results[0].error?.message).toBe('String error')
      })
    })

    describe('logging', () => {
      it('should log events when logger is enabled', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations, {
          enabled: true,
          logger: mockLogger,
        })
        const payload = createTrackPayload()

        await manager.process(payload)

        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            type: 'track',
            userId: 'user123',
            anonymousId: 'anon123',
            timestamp: payload.timestamp,
          },
          'Processing event'
        )

        expect(mockLogger.info).toHaveBeenCalledWith(
          { integration: 'MockSuccessfulIntegration' },
          'Starting integration'
        )

        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            integration: 'MockSuccessfulIntegration',
            duration: expect.any(Number),
          },
          'Integration completed successfully'
        )

        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            totalDuration: expect.any(Number),
            totalIntegrations: 1,
            successful: 1,
            failed: 0,
            results: expect.any(Array),
          },
          'Processing completed'
        )
      })

      it('should log errors when integration fails', async () => {
        const integrations = [new MockFailingIntegration()]
        const manager = new IntegrationManager(integrations, {
          enabled: true,
          logger: mockLogger,
        })
        const payload = createTrackPayload()

        await manager.process(payload)

        expect(mockLogger.error).toHaveBeenCalledWith(
          {
            integration: 'MockFailingIntegration',
            duration: expect.any(Number),
            error: expect.objectContaining({
              message: 'Track operation failed',
            }),
          },
          'Integration failed'
        )
      })

      it('should not log when logger is disabled', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        await manager.process(payload)

        expect(mockLogger.info).not.toHaveBeenCalled()
        expect(mockLogger.error).not.toHaveBeenCalled()
      })
    })

    describe('timing and performance', () => {
      it('should track duration for each integration', async () => {
        const integrations = [new MockSlowIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        const results = await manager.process(payload)

        expect(results[0].duration).toBeGreaterThan(90) // Should be ~100ms
      })

      it('should process integrations in parallel', async () => {
        const integrations = [new MockSlowIntegration(), new MockSlowIntegration()]
        const manager = new IntegrationManager(integrations)
        const payload = createTrackPayload()

        const startTime = Date.now()
        const results = await manager.process(payload)
        const totalTime = Date.now() - startTime

        expect(results).toHaveLength(2)
        expect(results.every((r) => r.success)).toBe(true)
        // Should be around 100ms (parallel) not 200ms (sequential)
        expect(totalTime).toBeLessThan(150)
      })
    })

    describe('edge cases', () => {
      it('should handle empty integrations array', async () => {
        const manager = new IntegrationManager([])
        const payload = createTrackPayload()

        const results = await manager.process(payload)

        expect(results).toHaveLength(0)
      })

      it('should handle payloads without userId but with anonymousId', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations, {
          enabled: true,
          logger: mockLogger,
        })
        const payload: TrackPayload = {
          type: 'track',
          event: 'Test Event',
          anonymousId: 'anon123',
          timestamp: new Date().toISOString(),
        }

        const results = await manager.process(payload)

        expect(results[0].success).toBe(true)
        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            type: 'track',
            userId: undefined,
            anonymousId: 'anon123',
            timestamp: payload.timestamp,
          },
          'Processing event'
        )
      })

      it('should handle payloads with userId but without anonymousId', async () => {
        const integrations = [new MockSuccessfulIntegration()]
        const manager = new IntegrationManager(integrations, {
          enabled: true,
          logger: mockLogger,
        })
        const payload: IdentifyPayload = {
          type: 'identify',
          userId: 'user123',
          traits: { name: 'John' },
          timestamp: new Date().toISOString(),
        }

        const results = await manager.process(payload)

        expect(results[0].success).toBe(true)
        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            type: 'identify',
            userId: 'user123',
            anonymousId: undefined,
            timestamp: payload.timestamp,
          },
          'Processing event'
        )
      })
    })
  })
})
