import { createRegulationRequestSchema } from '@app/spec'
import { defineEventHandler, readBody } from 'h3'

import { privacyRegulationService } from '@/integrations'
import type { RegulationService } from '@/privacy/regulation-service'
import { validatePrivacyAuthorization } from '@/utils/privacy-auth'

/**
 * BigQuery's streaming buffer usually drains within minutes but can take up to
 * ~90. Deletion is idempotent, so callers simply retry until FINISHED.
 */
export const REGULATION_RETRY_AFTER_SECONDS = 30 * 60

/** Segment regulation types that need durable state OpenTrack intentionally does not have. */
const STATEFUL_REGULATION_TYPES = new Set([
  'SUPPRESS_WITH_DELETE',
  'SUPPRESS_ONLY',
  'UNSUPPRESS',
  'DELETE_INTERNAL',
  'SUPPRESS_WITH_DELETE_INTERNAL',
  'DELETE_ARCHIVE_ONLY',
])

type PrivacyRegulator = Pick<RegulationService, 'deleteUsers'>

/**
 * POST /internal/v1/regulations
 *
 * Creates and synchronously executes a DELETE_ONLY regulation, modeled on
 * Segment's Deletion and Suppression API. See the README for the contract.
 * Exported as a factory so route tests can inject a regulation service.
 */
export function createRegulationsHandler(regulationService: PrivacyRegulator) {
  return defineEventHandler(async (event) => {
    const authorization = validatePrivacyAuthorization(event.node.req.headers.authorization)
    if (authorization === 'misconfigured') {
      event.node.res.statusCode = 503
      return { error: 'Privacy regulations are not configured', type: 'configuration_error' }
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

    const regulationType =
      body && typeof body === 'object' && 'regulationType' in body ? body.regulationType : undefined
    if (typeof regulationType === 'string' && STATEFUL_REGULATION_TYPES.has(regulationType)) {
      event.node.res.statusCode = 400
      return {
        error: 'OpenTrack is stateless and supports only DELETE_ONLY regulations',
        type: 'not_supported_error',
      }
    }

    const validation = createRegulationRequestSchema.safeParse(body)
    if (!validation.success) {
      event.node.res.statusCode = 400
      return { error: 'Invalid request body', type: 'validation_error' }
    }

    try {
      const result = await regulationService.deleteUsers(validation.data.subjectIds)
      const response = {
        regulationType: validation.data.regulationType,
        subjectType: validation.data.subjectType,
        status: result.status,
        destinations: result.destinations,
      }

      switch (result.status) {
        case 'FINISHED':
          return response
        case 'RUNNING':
          event.node.res.statusCode = 202
          event.node.res.setHeader('Retry-After', String(REGULATION_RETRY_AFTER_SECONDS))
          return response
        case 'NOT_SUPPORTED':
          event.node.res.statusCode = 501
          return response
        default:
          // FAILED / PARTIAL_SUCCESS: the caller retries; deletion is idempotent.
          event.node.res.statusCode = 502
          return response
      }
    } catch (error) {
      console.error('Privacy regulation failed', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      })
      event.node.res.statusCode = 503
      return { error: 'Privacy regulations are temporarily unavailable', type: 'service_unavailable' }
    }
  })
}

export default createRegulationsHandler(privacyRegulationService)
