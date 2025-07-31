import { describe, expect, it } from 'vitest'

import { WebhookErrorHandler } from '../../utils/error-handler'

describe('WebhookErrorHandler', () => {
  describe('mapError', () => {
    it('should map Axios errors correctly', () => {
      const axiosError = {
        isAxiosError: true,
        message: 'Request failed with status code 404',
        response: {
          status: 404,
          data: { error: 'Not found' },
        },
        code: 'ERR_BAD_REQUEST',
      }

      const result = WebhookErrorHandler.mapError(axiosError)

      expect(result).toMatchObject({
        name: 'WebhookError',
        message: 'Not Found: Webhook endpoint does not exist',
        statusCode: 404,
        code: 'ERR_BAD_REQUEST',
        response: { error: 'Not found' },
        isRetryable: false,
      })
    })

    it('should handle different HTTP status codes', () => {
      const statusTests = [
        { status: 400, expectedMessage: 'Bad Request: Invalid payload or request format', retryable: false },
        { status: 401, expectedMessage: 'Unauthorized: Invalid authentication credentials', retryable: false },
        { status: 403, expectedMessage: 'Forbidden: Access denied to webhook endpoint', retryable: false },
        { status: 429, expectedMessage: 'Rate Limited: Too many requests to webhook endpoint', retryable: true },
        {
          status: 500,
          expectedMessage: 'Internal Server Error: Webhook endpoint encountered an error',
          retryable: true,
        },
        { status: 502, expectedMessage: 'Bad Gateway: Webhook endpoint is unreachable', retryable: true },
        { status: 503, expectedMessage: 'Service Unavailable: Webhook endpoint is temporarily down', retryable: true },
        { status: 504, expectedMessage: 'Gateway Timeout: Webhook endpoint took too long to respond', retryable: true },
      ]

      for (const { status, expectedMessage, retryable } of statusTests) {
        const axiosError = {
          isAxiosError: true,
          message: `Request failed with status code ${status}`,
          response: { status },
        }

        const result = WebhookErrorHandler.mapError(axiosError)

        expect(result.message).toBe(expectedMessage)
        expect(result.isRetryable).toBe(retryable)
      }
    })

    it('should handle network errors', () => {
      const networkErrors = [
        { message: 'connect ECONNREFUSED 127.0.0.1:3000', code: 'ECONNREFUSED', retryable: true },
        { message: 'getaddrinfo ENOTFOUND example.com', code: 'ENOTFOUND', retryable: false },
        { message: 'timeout of 5000ms exceeded', code: 'ETIMEDOUT', retryable: true },
      ]

      for (const { message, code, retryable } of networkErrors) {
        const error = new Error(message)
        const result = WebhookErrorHandler.mapError(error)

        expect(result.name).toBe('WebhookError')
        expect(result.code).toBe(code)
        expect(result.isRetryable).toBe(retryable)
      }
    })

    it('should handle unknown errors', () => {
      const unknownError = 'Some unknown error'
      const result = WebhookErrorHandler.mapError(unknownError)

      expect(result).toMatchObject({
        name: 'WebhookError',
        message: 'Unknown error occurred while sending webhook',
        isRetryable: false,
      })
    })

    it('should handle regular Error objects', () => {
      const error = new Error('Custom error message')
      const result = WebhookErrorHandler.mapError(error)

      expect(result).toMatchObject({
        name: 'WebhookError',
        message: 'Custom error message',
        isRetryable: false,
      })
    })
  })

  describe('isRetryableError', () => {
    it('should identify retryable errors by explicit flag', () => {
      const retryableError = {
        name: 'WebhookError',
        message: 'Test error',
        isRetryable: true,
      }

      const nonRetryableError = {
        name: 'WebhookError',
        message: 'Test error',
        isRetryable: false,
      }

      expect(WebhookErrorHandler.isRetryableError(retryableError)).toBe(true)
      expect(WebhookErrorHandler.isRetryableError(nonRetryableError)).toBe(false)
    })

    it('should identify retryable errors by status code', () => {
      const retryableStatusCodes = [429, 500, 502, 503, 504]
      const nonRetryableStatusCodes = [400, 401, 403, 404, 422]

      for (const statusCode of retryableStatusCodes) {
        const error = {
          name: 'WebhookError',
          message: 'Test error',
          statusCode,
        }
        expect(WebhookErrorHandler.isRetryableError(error)).toBe(true)
      }

      for (const statusCode of nonRetryableStatusCodes) {
        const error = {
          name: 'WebhookError',
          message: 'Test error',
          statusCode,
        }
        expect(WebhookErrorHandler.isRetryableError(error)).toBe(false)
      }
    })

    it('should identify retryable errors by error code', () => {
      const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE']
      const nonRetryableCodes = ['ENOTFOUND', 'ERR_INVALID_URL']

      for (const code of retryableCodes) {
        const error = {
          name: 'WebhookError',
          message: 'Test error',
          code,
        }
        expect(WebhookErrorHandler.isRetryableError(error)).toBe(true)
      }

      for (const code of nonRetryableCodes) {
        const error = {
          name: 'WebhookError',
          message: 'Test error',
          code,
        }
        expect(WebhookErrorHandler.isRetryableError(error)).toBe(false)
      }
    })
  })

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      const delays = [
        WebhookErrorHandler.getRetryDelay(1),
        WebhookErrorHandler.getRetryDelay(2),
        WebhookErrorHandler.getRetryDelay(3),
        WebhookErrorHandler.getRetryDelay(4),
      ]

      // Each delay should be roughly double the previous (with jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(1000) // Base delay
      expect(delays[0]).toBeLessThanOrEqual(1100) // With jitter

      expect(delays[1]).toBeGreaterThanOrEqual(2000)
      expect(delays[1]).toBeLessThanOrEqual(2200)

      expect(delays[2]).toBeGreaterThanOrEqual(4000)
      expect(delays[2]).toBeLessThanOrEqual(4400)
    })

    it('should cap delay at maximum', () => {
      const longDelay = WebhookErrorHandler.getRetryDelay(10)
      expect(longDelay).toBeLessThanOrEqual(30000) // Max 30 seconds
    })

    it('should always return positive delay', () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const delay = WebhookErrorHandler.getRetryDelay(attempt)
        expect(delay).toBeGreaterThan(0)
      }
    })
  })
})
