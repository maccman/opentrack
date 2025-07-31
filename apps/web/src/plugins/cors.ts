/**
 * CORS Plugin - Dynamic Origin Handler
 *
 * Handles dynamic CORS origin logic for actual API requests (not OPTIONS).
 * Works alongside the explicit OPTIONS route handler and routeRules.
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

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    // Skip OPTIONS requests (handled by explicit OPTIONS route)
    if (event.node.req.method === 'OPTIONS') {
      return
    }

    // Handle dynamic origin logic for actual API requests
    const allowedOrigins = getAllowedOrigins()
    const requestOrigin = event.node.req.headers.origin
    const originHeader = getOriginHeader(requestOrigin, allowedOrigins)

    // Set the dynamic origin header for POST requests
    event.node.res.setHeader('Access-Control-Allow-Origin', originHeader)
    // Allow credentials for sendBeacon compatibility
    event.node.res.setHeader('Access-Control-Allow-Credentials', 'true')
  })
})
