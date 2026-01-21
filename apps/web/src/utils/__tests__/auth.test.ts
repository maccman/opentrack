import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createUnauthorizedResponse,
  extractWriteKeyFromBody,
  extractWriteKeyFromHeader,
  getConfiguredWriteKey,
  isAuthRequired,
  validateWriteKey,
} from '../auth'

describe('Auth Utilities', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getConfiguredWriteKey', () => {
    it('should return null when WRITE_KEY is not set', () => {
      vi.stubEnv('WRITE_KEY', '')
      expect(getConfiguredWriteKey()).toBeNull()
    })

    it('should return the write key when WRITE_KEY is set', () => {
      vi.stubEnv('WRITE_KEY', 'test-key-123')
      expect(getConfiguredWriteKey()).toBe('test-key-123')
    })
  })

  describe('isAuthRequired', () => {
    it('should return false when WRITE_KEY is not set', () => {
      vi.stubEnv('WRITE_KEY', '')
      expect(isAuthRequired()).toBe(false)
    })

    it('should return true when WRITE_KEY is set', () => {
      vi.stubEnv('WRITE_KEY', 'test-key-123')
      expect(isAuthRequired()).toBe(true)
    })
  })

  describe('extractWriteKeyFromHeader', () => {
    it('should return null for undefined header', () => {
      expect(extractWriteKeyFromHeader(undefined)).toBeNull()
    })

    it('should return null for empty header', () => {
      expect(extractWriteKeyFromHeader('')).toBeNull()
    })

    it('should return null for non-Basic auth header', () => {
      expect(extractWriteKeyFromHeader('Bearer token123')).toBeNull()
    })

    it('should extract writeKey from valid Basic auth header', () => {
      // "test-key:" encoded in base64 is "dGVzdC1rZXk6"
      const encoded = Buffer.from('test-key:').toString('base64')
      expect(extractWriteKeyFromHeader(`Basic ${encoded}`)).toBe('test-key')
    })

    it('should handle Basic auth with password (ignore password)', () => {
      // "test-key:password" encoded in base64
      const encoded = Buffer.from('test-key:password').toString('base64')
      expect(extractWriteKeyFromHeader(`Basic ${encoded}`)).toBe('test-key')
    })

    it('should be case-insensitive for Basic keyword', () => {
      const encoded = Buffer.from('test-key:').toString('base64')
      expect(extractWriteKeyFromHeader(`basic ${encoded}`)).toBe('test-key')
      expect(extractWriteKeyFromHeader(`BASIC ${encoded}`)).toBe('test-key')
    })

    it('should handle malformed base64 gracefully', () => {
      // Buffer.from doesn't throw for invalid base64, it returns garbage
      // The resulting "key" will simply fail validation
      const result = extractWriteKeyFromHeader('Basic !!invalid!!')
      // Result is some decoded garbage, but not null - validation will reject it
      expect(typeof result).toBe('string')
    })
  })

  describe('extractWriteKeyFromBody', () => {
    it('should return null for null body', () => {
      expect(extractWriteKeyFromBody(null)).toBeNull()
    })

    it('should return null for undefined body', () => {
      expect(extractWriteKeyFromBody(undefined)).toBeNull()
    })

    it('should return null for non-object body', () => {
      expect(extractWriteKeyFromBody('string')).toBeNull()
      expect(extractWriteKeyFromBody(123)).toBeNull()
    })

    it('should return null when writeKey is not present', () => {
      expect(extractWriteKeyFromBody({ event: 'test' })).toBeNull()
    })

    it('should return null when writeKey is not a string', () => {
      expect(extractWriteKeyFromBody({ writeKey: 123 })).toBeNull()
      expect(extractWriteKeyFromBody({ writeKey: null })).toBeNull()
      expect(extractWriteKeyFromBody({ writeKey: { nested: true } })).toBeNull()
    })

    it('should extract writeKey from body', () => {
      expect(extractWriteKeyFromBody({ writeKey: 'test-key-123' })).toBe('test-key-123')
    })

    it('should extract writeKey from body with other fields', () => {
      expect(
        extractWriteKeyFromBody({
          writeKey: 'test-key-123',
          event: 'Test Event',
          userId: 'user-1',
        })
      ).toBe('test-key-123')
    })
  })

  describe('validateWriteKey', () => {
    it('should return true when auth is not required (no WRITE_KEY configured)', () => {
      vi.stubEnv('WRITE_KEY', '')
      expect(validateWriteKey(null)).toBe(true)
      expect(validateWriteKey('any-key')).toBe(true)
    })

    it('should return false when auth is required but writeKey is null', () => {
      vi.stubEnv('WRITE_KEY', 'correct-key')
      expect(validateWriteKey(null)).toBe(false)
    })

    it('should return false when auth is required but writeKey is wrong', () => {
      vi.stubEnv('WRITE_KEY', 'correct-key')
      expect(validateWriteKey('wrong-key')).toBe(false)
    })

    it('should return true when writeKey matches configured key', () => {
      vi.stubEnv('WRITE_KEY', 'correct-key')
      expect(validateWriteKey('correct-key')).toBe(true)
    })
  })

  describe('createUnauthorizedResponse', () => {
    it('should return proper 401 response object', () => {
      const response = createUnauthorizedResponse()
      expect(response).toEqual({
        error: 'Invalid write key',
        type: 'authentication_error',
      })
    })
  })
})
