/**
 * CORS Plugin - Dynamic Origin Handler
 *
 * Handles dynamic CORS origin logic for actual API requests (not OPTIONS).
 * Works alongside the explicit OPTIONS route handler.
 *
 * Environment Variables:
 * - CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins (default: "*")
 *
 * Examples:
 * - Allow all origins: CORS_ALLOWED_ORIGINS="*"
 * - Specific origins: CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
 * - Development: CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
 */

import { CORS_HEADERS, getAllowedOrigins, getOriginHeader } from '@/utils/cors'

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

    // Set CORS headers for POST requests
    event.node.res.setHeader(CORS_HEADERS.ALLOW_ORIGIN, originHeader)
    event.node.res.setHeader(CORS_HEADERS.ALLOW_CREDENTIALS, 'true')
  })
})
