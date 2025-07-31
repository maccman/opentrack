import { defineEventHandler } from 'h3'

/**
 * CORS Middleware
 *
 * Configures Cross-Origin Resource Sharing (CORS) headers for all requests.
 * Optimized for analytics endpoints which only use POST requests.
 *
 * Environment Variables:
 * - CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins (default: "*")
 *
 * Examples:
 * - Allow all origins: CORS_ALLOWED_ORIGINS="*"
 * - Specific origins: CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
 * - Development: CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
 */

function getAllowedOrigins(): string[] {
  return process.env.CORS_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) || ['*']
}

function getOriginHeader(requestOrigin: string | undefined, allowedOrigins: string[]): string {
  // If no origin restrictions (wildcard), return wildcard
  if (allowedOrigins.includes('*')) {
    return '*'
  }

  // If no origin in request, default to first allowed origin or wildcard
  if (!requestOrigin) {
    return allowedOrigins[0] || '*'
  }

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

  // Default to first allowed origin if origin not allowed
  return allowedOrigins[0] || '*'
}

export default defineEventHandler((event) => {
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = event.node.req.headers.origin

  // Set CORS headers
  const originHeader = getOriginHeader(requestOrigin, allowedOrigins)
  event.node.res.setHeader('Access-Control-Allow-Origin', originHeader)

  // Fixed methods for analytics endpoints (POST) and preflight (OPTIONS)
  event.node.res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  // Fixed headers needed for analytics requests
  event.node.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Cache preflight requests for 24 hours
  event.node.res.setHeader('Access-Control-Max-Age', '86400')

  // Handle preflight OPTIONS requests
  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
    return
  }
})
