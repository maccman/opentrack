/**
 * CORS Preflight OPTIONS Handler
 *
 * Handles all OPTIONS requests for v1 API routes to support CORS preflight.
 * This catch-all route ensures that any OPTIONS request to /v1/* returns
 * proper CORS headers with a 204 No Content response.
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

export default defineEventHandler((event) => {
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = event.node.req.headers.origin
  const originHeader = getOriginHeader(requestOrigin, allowedOrigins)

  // Set CORS headers for preflight response
  setHeader(event, 'Access-Control-Allow-Origin', originHeader)
  setHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
  setHeader(event, 'Access-Control-Max-Age', 86400)
  setHeader(event, 'Access-Control-Allow-Credentials', 'true')

  // Return 204 No Content for OPTIONS requests
  setResponseStatus(event, 204)
  return ''
})
