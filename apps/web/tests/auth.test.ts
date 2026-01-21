/**
 * Write Key Authentication Tests
 *
 * These tests verify the authentication behavior when WRITE_KEY is configured.
 * They use a mock approach to test the auth logic without needing to restart the server.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createUnauthorizedResponse,
  extractWriteKeyFromBody,
  extractWriteKeyFromHeader,
  isAuthRequired,
  validateWriteKey,
} from '../src/utils/auth'

describe('Write Key Authentication', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  describe('when WRITE_KEY is configured', () => {
    const CONFIGURED_KEY = 'secret-write-key-123'

    beforeEach(() => {
      vi.stubEnv('WRITE_KEY', CONFIGURED_KEY)
    })

    it('should require authentication', () => {
      expect(isAuthRequired()).toBe(true)
    })

    it('should reject requests without writeKey', () => {
      expect(validateWriteKey(null)).toBe(false)
    })

    it('should reject requests with wrong writeKey', () => {
      expect(validateWriteKey('wrong-key')).toBe(false)
      expect(validateWriteKey('')).toBe(false)
      expect(validateWriteKey('secret-write-key-12')).toBe(false) // Almost correct
    })

    it('should accept requests with correct writeKey', () => {
      expect(validateWriteKey(CONFIGURED_KEY)).toBe(true)
    })

    it('should extract writeKey from valid Authorization header', () => {
      const encoded = Buffer.from(`${CONFIGURED_KEY}:`).toString('base64')
      const authHeader = `Basic ${encoded}`

      const extractedKey = extractWriteKeyFromHeader(authHeader)
      expect(extractedKey).toBe(CONFIGURED_KEY)
      expect(validateWriteKey(extractedKey)).toBe(true)
    })

    it('should extract writeKey from request body', () => {
      const body = {
        userId: 'user-123',
        event: 'Test Event',
        writeKey: CONFIGURED_KEY,
      }

      const extractedKey = extractWriteKeyFromBody(body)
      expect(extractedKey).toBe(CONFIGURED_KEY)
      expect(validateWriteKey(extractedKey)).toBe(true)
    })

    it('should return proper unauthorized response', () => {
      const response = createUnauthorizedResponse()
      expect(response).toEqual({
        error: 'Invalid write key',
        type: 'authentication_error',
      })
    })
  })

  describe('when WRITE_KEY is not configured', () => {
    beforeEach(() => {
      vi.stubEnv('WRITE_KEY', '')
    })

    it('should not require authentication', () => {
      expect(isAuthRequired()).toBe(false)
    })

    it('should accept requests without writeKey', () => {
      expect(validateWriteKey(null)).toBe(true)
    })

    it('should accept requests with any writeKey', () => {
      expect(validateWriteKey('any-key')).toBe(true)
      expect(validateWriteKey('random-value')).toBe(true)
    })

    it('should still extract writeKey from header (for logging/debugging)', () => {
      const encoded = Buffer.from('some-key:').toString('base64')
      const extractedKey = extractWriteKeyFromHeader(`Basic ${encoded}`)
      expect(extractedKey).toBe('some-key')
    })

    it('should still extract writeKey from body (for logging/debugging)', () => {
      const body = { writeKey: 'some-key', event: 'test' }
      const extractedKey = extractWriteKeyFromBody(body)
      expect(extractedKey).toBe('some-key')
    })
  })

  describe('Authorization header parsing', () => {
    it('should handle various valid formats', () => {
      const testCases = [
        { key: 'simple', header: `Basic ${Buffer.from('simple:').toString('base64')}` },
        { key: 'with-dashes', header: `Basic ${Buffer.from('with-dashes:').toString('base64')}` },
        { key: 'with_underscores', header: `Basic ${Buffer.from('with_underscores:').toString('base64')}` },
        { key: 'MixedCase123', header: `Basic ${Buffer.from('MixedCase123:').toString('base64')}` },
      ]

      for (const { key, header } of testCases) {
        expect(extractWriteKeyFromHeader(header)).toBe(key)
      }
    })

    it('should reject non-Basic auth schemes', () => {
      expect(extractWriteKeyFromHeader('Bearer token123')).toBeNull()
      expect(extractWriteKeyFromHeader('Digest username="test"')).toBeNull()
      expect(extractWriteKeyFromHeader('ApiKey abc123')).toBeNull()
    })

    it('should handle whitespace variations', () => {
      const encoded = Buffer.from('test-key:').toString('base64')
      // Single space after Basic is standard
      expect(extractWriteKeyFromHeader(`Basic ${encoded}`)).toBe('test-key')
      // Multiple spaces should also work (regex uses \s+)
      expect(extractWriteKeyFromHeader(`Basic  ${encoded}`)).toBe('test-key')
    })
  })

  describe('Request body parsing', () => {
    it('should handle various body formats', () => {
      // Track event
      expect(
        extractWriteKeyFromBody({
          type: 'track',
          userId: 'user-1',
          event: 'Test',
          writeKey: 'key-1',
        })
      ).toBe('key-1')

      // Identify event
      expect(
        extractWriteKeyFromBody({
          type: 'identify',
          userId: 'user-1',
          traits: { email: 'test@test.com' },
          writeKey: 'key-2',
        })
      ).toBe('key-2')

      // Batch request
      expect(
        extractWriteKeyFromBody({
          batch: [{ type: 'track', event: 'Test' }],
          writeKey: 'key-3',
        })
      ).toBe('key-3')
    })

    it('should return null for missing writeKey', () => {
      expect(extractWriteKeyFromBody({ event: 'test' })).toBeNull()
      expect(extractWriteKeyFromBody({})).toBeNull()
    })

    it('should return null for non-string writeKey', () => {
      expect(extractWriteKeyFromBody({ writeKey: 123 })).toBeNull()
      expect(extractWriteKeyFromBody({ writeKey: true })).toBeNull()
      expect(extractWriteKeyFromBody({ writeKey: ['array'] })).toBeNull()
      expect(extractWriteKeyFromBody({ writeKey: { nested: 'object' } })).toBeNull()
    })
  })
})
