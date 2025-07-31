/**
 * CORS Preflight OPTIONS Handler
 *
 * Handles all OPTIONS requests for v1 API routes to support CORS preflight.
 * This catch-all route ensures that any OPTIONS request to /v1/* returns
 * proper CORS headers with a 204 No Content response.
 */

import { setCorsHeaders } from '@/utils/cors'

export default defineEventHandler((event) => {
  const requestOrigin = event.node.req.headers.origin

  // Set all CORS headers for preflight response
  setCorsHeaders(
    {
      set: (key: string, value: string | number) => setHeader(event, key, value),
    },
    requestOrigin
  )

  // Return 204 No Content for OPTIONS requests
  setResponseStatus(event, 204)
  return ''
})
