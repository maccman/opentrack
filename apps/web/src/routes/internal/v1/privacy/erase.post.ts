import { privacyEraseRequestSchema } from '@app/spec'
import { defineEventHandler, readBody } from 'h3'

import { privacyErasureService } from '@/integrations'
import { PrivacyErasureError, type PrivacyErasureService } from '@/privacy/erasure-service'
import { validatePrivacyAuthorization } from '@/utils/privacy-auth'

function configurationError() {
  return { error: 'Privacy erasure is not configured', type: 'configuration_error' }
}

type PrivacyEraser = Pick<PrivacyErasureService, 'erase'>

/** Creates the HTTP handler with an injectable erasure service for route-level tests. */
export function createPrivacyEraseHandler(erasureService: PrivacyEraser | null) {
  return defineEventHandler(async (event) => {
    const authorization = validatePrivacyAuthorization(event.node.req.headers.authorization)
    if (authorization === 'misconfigured') {
      event.node.res.statusCode = 503
      return configurationError()
    }
    if (authorization === 'unauthorized') {
      event.node.res.statusCode = 401
      event.node.res.setHeader('WWW-Authenticate', 'Bearer')
      return { error: 'Unauthorized', type: 'authentication_error' }
    }

    const contentType = event.node.req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
    if (contentType !== 'application/json') {
      event.node.res.statusCode = 415
      return { error: 'Content-Type must be application/json', type: 'validation_error' }
    }

    let body: unknown
    try {
      body = await readBody(event)
    } catch {
      event.node.res.statusCode = 400
      return { error: 'Invalid request body', type: 'validation_error' }
    }

    const bodyValidation = privacyEraseRequestSchema.safeParse(body)
    if (!bodyValidation.success) {
      event.node.res.statusCode = 400
      return { error: 'Invalid request body', type: 'validation_error' }
    }
    if (!erasureService) {
      event.node.res.statusCode = 503
      return configurationError()
    }

    try {
      const result = await erasureService.erase(bodyValidation.data.userId)
      if (result.status === 'pending') {
        event.node.res.statusCode = 202
        event.node.res.setHeader('Retry-After', String(result.retryAfterSeconds))
      }
      return result
    } catch (error) {
      console.error('Privacy erasure failed', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        ...(error instanceof PrivacyErasureError ? { failedDestinations: error.failedDestinations } : {}),
      })
      event.node.res.statusCode = 503
      return { error: 'Privacy erasure is temporarily unavailable', type: 'service_unavailable' }
    }
  })
}

export default createPrivacyEraseHandler(privacyErasureService)
