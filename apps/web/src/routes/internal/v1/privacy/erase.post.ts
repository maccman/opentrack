import { privacyEraseIdempotencyKeySchema, privacyEraseRequestSchema } from '@app/spec'
import { defineEventHandler, readBody } from 'h3'

import { privacyErasureService, suppressionEnforcementEnabled } from '@/integrations'
import { SuppressionIdempotencyConflictError, SuppressionLedgerConfigurationError } from '@/privacy/suppression-ledger'
import { validatePrivacyAuthorization } from '@/utils/privacy-auth'

function configurationError() {
  return { error: 'Privacy erasure is not configured', type: 'configuration_error' }
}

export default defineEventHandler(async (event) => {
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
  const idempotencyValidation = privacyEraseIdempotencyKeySchema.safeParse(event.node.req.headers['idempotency-key'])
  if (!idempotencyValidation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid Idempotency-Key', type: 'validation_error' }
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
  if (!suppressionEnforcementEnabled) {
    event.node.res.statusCode = 503
    return configurationError()
  }

  try {
    const result = await privacyErasureService.erase({
      userId: bodyValidation.data.userId,
      idempotencyKey: idempotencyValidation.data,
    })

    if (result.status === 'pending') {
      event.node.res.statusCode = 202
      event.node.res.setHeader('Retry-After', String(result.retryAfterSeconds))
      return result
    }
    if (result.status === 'blocked') {
      event.node.res.statusCode = 503
      return result
    }

    return result
  } catch (error) {
    if (error instanceof SuppressionIdempotencyConflictError) {
      event.node.res.statusCode = 409
      return { error: 'Idempotency-Key conflict', type: 'conflict_error' }
    }
    if (error instanceof SuppressionLedgerConfigurationError) {
      event.node.res.statusCode = 503
      return configurationError()
    }

    console.error('Privacy erasure failed', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    })
    event.node.res.statusCode = 503
    return { error: 'Privacy erasure is temporarily unavailable', type: 'service_unavailable' }
  }
})
