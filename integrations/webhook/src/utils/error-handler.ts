import type { AxiosError } from 'axios'

export interface WebhookError extends Error {
  statusCode?: number
  code?: string
  response?: unknown
  isRetryable?: boolean
}

function isAxiosError(error: unknown): error is AxiosError {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error && error.isAxiosError === true
}

export class WebhookErrorHandler {
  /**
   * Maps various error types to a consistent WebhookError format
   */
  static mapError(error: unknown): WebhookError {
    if (isAxiosError(error)) {
      const webhookError: WebhookError = {
        name: 'WebhookError',
        message: error.message || 'Unknown webhook error',
        statusCode: error.response?.status,
        code: error.code,
        response: error.response?.data,
        isRetryable: this.isRetryableStatusCode(error.response?.status),
      }

      // Enhanced error messages based on status codes
      if (error.response?.status) {
        switch (error.response.status) {
          case 400:
            webhookError.message = 'Bad Request: Invalid payload or request format'
            break
          case 401:
            webhookError.message = 'Unauthorized: Invalid authentication credentials'
            break
          case 403:
            webhookError.message = 'Forbidden: Access denied to webhook endpoint'
            break
          case 404:
            webhookError.message = 'Not Found: Webhook endpoint does not exist'
            break
          case 422:
            webhookError.message = 'Unprocessable Entity: Payload validation failed'
            break
          case 429:
            webhookError.message = 'Rate Limited: Too many requests to webhook endpoint'
            break
          case 500:
            webhookError.message = 'Internal Server Error: Webhook endpoint encountered an error'
            break
          case 502:
            webhookError.message = 'Bad Gateway: Webhook endpoint is unreachable'
            break
          case 503:
            webhookError.message = 'Service Unavailable: Webhook endpoint is temporarily down'
            break
          case 504:
            webhookError.message = 'Gateway Timeout: Webhook endpoint took too long to respond'
            break
          default:
            webhookError.message = `HTTP ${error.response.status}: ${error.message}`
        }
      }

      return webhookError
    }

    // Handle network errors
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        return {
          name: 'WebhookError',
          message: 'Connection Refused: Cannot connect to webhook endpoint',
          code: 'ECONNREFUSED',
          isRetryable: true,
        }
      }

      if (error.message.includes('ENOTFOUND')) {
        return {
          name: 'WebhookError',
          message: 'DNS Error: Webhook endpoint hostname not found',
          code: 'ENOTFOUND',
          isRetryable: false,
        }
      }

      if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        return {
          name: 'WebhookError',
          message: 'Timeout: Webhook endpoint took too long to respond',
          code: 'ETIMEDOUT',
          isRetryable: true,
        }
      }

      return {
        name: 'WebhookError',
        message: error.message,
        isRetryable: false,
      }
    }

    // Fallback for unknown error types
    return {
      name: 'WebhookError',
      message: 'Unknown error occurred while sending webhook',
      isRetryable: false,
    }
  }

  /**
   * Determines if an error is retryable based on the WebhookError properties
   */
  static isRetryableError(error: WebhookError): boolean {
    if (error.isRetryable !== undefined) {
      return error.isRetryable
    }

    // Check by status code
    if (error.statusCode) {
      return this.isRetryableStatusCode(error.statusCode)
    }

    // Check by error code
    const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE']
    return retryableCodes.includes(error.code || '')
  }

  /**
   * Determines if an HTTP status code is retryable
   */
  private static isRetryableStatusCode(statusCode?: number): boolean {
    if (!statusCode) {
      return false
    }

    // Retryable status codes
    const retryableStatusCodes = [
      429, // Rate Limited
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ]

    return retryableStatusCodes.includes(statusCode)
  }

  /**
   * Calculates exponential backoff delay for retries
   */
  static getRetryDelay(attempt: number): number {
    // Base delay of 1 second, exponentially increasing
    const baseDelay = 1000
    const maxDelay = 30000 // Max 30 seconds

    const delay = baseDelay * Math.pow(2, attempt - 1)

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay

    return Math.min(delay + jitter, maxDelay)
  }
}
