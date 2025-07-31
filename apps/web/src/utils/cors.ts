/**
 * CORS Utilities
 *
 * Shared utilities for handling Cross-Origin Resource Sharing (CORS)
 * across the analytics API endpoints.
 */

export interface CorsConfig {
  allowedOrigins: string[]
  allowedMethods: string[]
  allowedHeaders: string[]
  maxAge: number
  allowCredentials: boolean
}

export const CORS_HEADERS = {
  ALLOW_ORIGIN: 'Access-Control-Allow-Origin',
  ALLOW_METHODS: 'Access-Control-Allow-Methods',
  ALLOW_HEADERS: 'Access-Control-Allow-Headers',
  ALLOW_CREDENTIALS: 'Access-Control-Allow-Credentials',
  MAX_AGE: 'Access-Control-Max-Age',
} as const

export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
  allowCredentials: true,
}

/**
 * Parse allowed origins from environment variable
 */
export function getAllowedOrigins(): string[] {
  return (
    process.env.CORS_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) || DEFAULT_CORS_CONFIG.allowedOrigins
  )
}

/**
 * Determine the appropriate Access-Control-Allow-Origin header value
 * based on the request origin and allowed origins configuration.
 *
 * Returns specific origins when possible (required for credentials),
 * falls back to wildcard only when no specific origin is available.
 */
export function getOriginHeader(requestOrigin: string | undefined, allowedOrigins: string[]): string {
  // If we have a specific origin in the request, try to match it first
  if (requestOrigin) {
    // Check if the request origin is in the allowed list
    if (allowedOrigins.includes(requestOrigin)) {
      return requestOrigin
    }

    // Check for localhost patterns in development
    if (process.env.NODE_ENV === 'development') {
      const localhostPattern = /^https?:\/\/localhost(:\d+)?$/
      if (localhostPattern.test(requestOrigin)) {
        return requestOrigin
      }
    }

    // If wildcard is allowed, return the specific requesting origin instead of '*'
    if (allowedOrigins.includes('*')) {
      return requestOrigin
    }
  }

  // Default to first specific allowed origin or wildcard only if no request origin
  return allowedOrigins[0] || '*'
}

/**
 * Set standard CORS headers on a response
 */
export function setCorsHeaders(
  headers: { set: (key: string, value: string | number) => void },
  requestOrigin: string | undefined,
  config: Partial<CorsConfig> = {}
): void {
  const corsConfig = { ...DEFAULT_CORS_CONFIG, ...config }
  const originHeader = getOriginHeader(requestOrigin, corsConfig.allowedOrigins)

  headers.set(CORS_HEADERS.ALLOW_ORIGIN, originHeader)
  headers.set(CORS_HEADERS.ALLOW_METHODS, corsConfig.allowedMethods.join(', '))
  headers.set(CORS_HEADERS.ALLOW_HEADERS, corsConfig.allowedHeaders.join(', '))
  headers.set(CORS_HEADERS.MAX_AGE, corsConfig.maxAge)

  if (corsConfig.allowCredentials) {
    headers.set(CORS_HEADERS.ALLOW_CREDENTIALS, 'true')
  }
}
