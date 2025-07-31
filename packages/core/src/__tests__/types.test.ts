import type { IdentifyPayload, TrackPayload } from '@app/spec'
import { describe, expect, it } from 'vitest'

import type { IntegrationPayload, IntegrationResult, LoggerConfig } from '../integrations/types'

describe('Integration Types', () => {
  describe('IntegrationPayload', () => {
    it('should accept TrackPayload', () => {
      const trackPayload: TrackPayload = {
        type: 'track',
        event: 'Test Event',
        userId: 'user123',
        timestamp: new Date().toISOString(),
      }

      const payload: IntegrationPayload = trackPayload
      expect(payload.type).toBe('track')
    })

    it('should accept IdentifyPayload', () => {
      const identifyPayload: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: { name: 'John Doe' },
        timestamp: new Date().toISOString(),
      }

      const payload: IntegrationPayload = identifyPayload
      expect(payload.type).toBe('identify')
    })
  })

  describe('IntegrationResult', () => {
    it('should create successful result', () => {
      const result: IntegrationResult = {
        integrationName: 'TestIntegration',
        success: true,
        duration: 100,
      }

      expect(result.integrationName).toBe('TestIntegration')
      expect(result.success).toBe(true)
      expect(result.duration).toBe(100)
      expect(result.error).toBeUndefined()
    })

    it('should create failed result with error', () => {
      const error = new Error('Test error')
      const result: IntegrationResult = {
        integrationName: 'TestIntegration',
        success: false,
        duration: 50,
        error,
      }

      expect(result.integrationName).toBe('TestIntegration')
      expect(result.success).toBe(false)
      expect(result.duration).toBe(50)
      expect(result.error).toBe(error)
    })
  })

  describe('LoggerConfig', () => {
    it('should create config with enabled logger', () => {
      const config: LoggerConfig = {
        enabled: true,
      }

      expect(config.enabled).toBe(true)
      expect(config.logger).toBeUndefined()
    })

    it('should create config with custom logger', () => {
      const mockLogger = {
        info: (): void => {},
        error: (): void => {},
      } as unknown as LoggerConfig['logger']

      const config: LoggerConfig = {
        enabled: true,
        logger: mockLogger,
      }

      expect(config.enabled).toBe(true)
      expect(config.logger).toBe(mockLogger)
    })

    it('should create config with disabled logger', () => {
      const config: LoggerConfig = {
        enabled: false,
      }

      expect(config.enabled).toBe(false)
    })
  })
})
