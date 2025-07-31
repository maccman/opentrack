import { describe, expect, it } from 'vitest'
import { CustomerioErrorHandler } from '../../utils/error-handler'

describe('CustomerioErrorHandler', () => {
  describe('mapError', () => {
    it('should map 400 status code to ValidationError', () => {
      const error = {
        statusCode: 400,
        message: 'Invalid request',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('ValidationError')
      expect(mapped.code).toBe('VALIDATION_ERROR')
      expect(mapped.statusCode).toBe(400)
      expect(mapped.message).toContain('Invalid request data')
    })

    it('should map 401 status code to AuthenticationError', () => {
      const error = {
        statusCode: 401,
        message: 'Unauthorized',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('AuthenticationError')
      expect(mapped.code).toBe('AUTHENTICATION_ERROR')
      expect(mapped.statusCode).toBe(401)
      expect(mapped.message).toContain('Invalid Customer.io credentials')
    })

    it('should map 403 status code to AuthorizationError', () => {
      const error = {
        statusCode: 403,
        message: 'Forbidden',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('AuthorizationError')
      expect(mapped.code).toBe('AUTHORIZATION_ERROR')
      expect(mapped.statusCode).toBe(403)
    })

    it('should map 429 status code to RateLimitError', () => {
      const error = {
        statusCode: 429,
        message: 'Too Many Requests',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('RateLimitError')
      expect(mapped.code).toBe('RATE_LIMIT_ERROR')
      expect(mapped.statusCode).toBe(429)
    })

    it('should map 500 status code to ServerError', () => {
      const error = {
        statusCode: 500,
        message: 'Internal Server Error',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('ServerError')
      expect(mapped.code).toBe('SERVER_ERROR')
      expect(mapped.statusCode).toBe(500)
    })

    it('should map network errors', () => {
      const error = {
        code: 'ECONNRESET',
        message: 'Connection reset',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('NetworkError')
      expect(mapped.code).toBe('NETWORK_ERROR')
    })

    it('should map timeout errors', () => {
      const error = {
        code: 'ETIMEDOUT',
        message: 'Request timeout',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('TimeoutError')
      expect(mapped.code).toBe('TIMEOUT_ERROR')
    })

    it('should map unknown errors', () => {
      const error = {
        message: 'Something went wrong',
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.name).toBe('CustomerioError')
      expect(mapped.code).toBe('UNKNOWN_ERROR')
      expect(mapped.message).toBe('Something went wrong')
    })

    it('should handle errors without message', () => {
      const error = {
        statusCode: 400,
      }

      const mapped = CustomerioErrorHandler.mapError(error)
      expect(mapped.message).toContain('Bad Request')
    })
  })

  describe('isRetryableError', () => {
    it('should return true for rate limit errors', () => {
      const error = { statusCode: 429, name: 'RateLimitError', message: 'Rate limited' }
      expect(CustomerioErrorHandler.isRetryableError(error)).toBe(true)
    })

    it('should return true for server errors', () => {
      const serverErrors = [500, 502, 503, 504]

      serverErrors.forEach((statusCode) => {
        const error = { statusCode, name: 'ServerError', message: 'Server error' }
        expect(CustomerioErrorHandler.isRetryableError(error)).toBe(true)
      })
    })

    it('should return true for network errors', () => {
      const error = { code: 'NETWORK_ERROR', name: 'NetworkError', message: 'Network error' }
      expect(CustomerioErrorHandler.isRetryableError(error)).toBe(true)
    })

    it('should return true for timeout errors', () => {
      const error = { code: 'TIMEOUT_ERROR', name: 'TimeoutError', message: 'Timeout error' }
      expect(CustomerioErrorHandler.isRetryableError(error)).toBe(true)
    })

    it('should return false for validation errors', () => {
      const error = { statusCode: 400, name: 'ValidationError', message: 'Validation error' }
      expect(CustomerioErrorHandler.isRetryableError(error)).toBe(false)
    })

    it('should return false for authentication errors', () => {
      const error = { statusCode: 401, name: 'AuthenticationError', message: 'Auth error' }
      expect(CustomerioErrorHandler.isRetryableError(error)).toBe(false)
    })
  })

  describe('getRetryDelay', () => {
    it('should return exponential backoff delays', () => {
      expect(CustomerioErrorHandler.getRetryDelay(0)).toBe(1000)
      expect(CustomerioErrorHandler.getRetryDelay(1)).toBe(2000)
      expect(CustomerioErrorHandler.getRetryDelay(2)).toBe(4000)
      expect(CustomerioErrorHandler.getRetryDelay(3)).toBe(8000)
      expect(CustomerioErrorHandler.getRetryDelay(4)).toBe(16000)
    })

    it('should cap at maximum delay', () => {
      expect(CustomerioErrorHandler.getRetryDelay(10)).toBe(16000)
    })
  })
})
