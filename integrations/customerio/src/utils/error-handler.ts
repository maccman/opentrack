export interface CustomerioError extends Error {
  statusCode?: number
  code?: string
  response?: any
}

export class CustomerioErrorHandler {
  static mapError(error: any): CustomerioError {
    if (error.statusCode) {
      switch (error.statusCode) {
        case 400:
          return {
            name: 'ValidationError',
            message: `Invalid request data: ${error.message || 'Bad Request'}`,
            statusCode: error.statusCode,
            code: 'VALIDATION_ERROR',
            response: error.response,
          }
        case 401:
          return {
            name: 'AuthenticationError',
            message: 'Invalid Customer.io credentials. Check your site ID and API key.',
            statusCode: error.statusCode,
            code: 'AUTHENTICATION_ERROR',
            response: error.response,
          }
        case 403:
          return {
            name: 'AuthorizationError',
            message: 'Access denied. Check your API permissions.',
            statusCode: error.statusCode,
            code: 'AUTHORIZATION_ERROR',
            response: error.response,
          }
        case 429:
          return {
            name: 'RateLimitError',
            message: 'Rate limit exceeded. Please slow down your requests.',
            statusCode: error.statusCode,
            code: 'RATE_LIMIT_ERROR',
            response: error.response,
          }
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            name: 'ServerError',
            message: `Customer.io server error: ${error.message || 'Internal Server Error'}`,
            statusCode: error.statusCode,
            code: 'SERVER_ERROR',
            response: error.response,
          }
        default:
          return {
            name: 'CustomerioError',
            message: error.message || 'Unknown Customer.io error',
            statusCode: error.statusCode,
            code: 'UNKNOWN_ERROR',
            response: error.response,
          }
      }
    }

    // Network or other errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      return {
        name: 'NetworkError',
        message: 'Network connection error. Please check your internet connection.',
        code: 'NETWORK_ERROR',
      }
    }

    if (error.code === 'ETIMEDOUT') {
      return {
        name: 'TimeoutError',
        message: 'Request timeout. Customer.io took too long to respond.',
        code: 'TIMEOUT_ERROR',
      }
    }

    return {
      name: 'CustomerioError',
      message: error.message || 'Unknown error occurred',
      code: 'UNKNOWN_ERROR',
    }
  }

  static isRetryableError(error: CustomerioError): boolean {
    return (
      error.statusCode === 429 || // Rate limit
      error.statusCode === 500 || // Internal server error
      error.statusCode === 502 || // Bad gateway
      error.statusCode === 503 || // Service unavailable
      error.statusCode === 504 || // Gateway timeout
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT_ERROR'
    )
  }

  static getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attempt), 16000)
  }
}
