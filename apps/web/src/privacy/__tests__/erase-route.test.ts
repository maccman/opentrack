import { createApp, toWebHandler } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPrivacyEraseHandler } from '../../routes/internal/v1/privacy/erase.post'
import { PrivacyErasureError, type PrivacyErasureResult } from '../erasure-service'

const endpoint = 'http://localhost/internal/v1/privacy/erase'
const userId = 'b9a54fe6-c995-4f14-9d85-0769b11dfe57'

function createRoute(erasureService: Parameters<typeof createPrivacyEraseHandler>[0]) {
  const app = createApp().use('/internal/v1/privacy/erase', createPrivacyEraseHandler(erasureService))
  return toWebHandler(app)
}

function eraseRequest(route: ReturnType<typeof createRoute>) {
  return route(
    new Request(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-erasure-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    })
  )
}

function resolvedService(result: PrivacyErasureResult) {
  return { erase: vi.fn().mockResolvedValue(result) }
}

describe('privacy erasure route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 200 when every destination completes', async () => {
    const result: PrivacyErasureResult = {
      status: 'complete',
      destinations: { bigQuery: 'erased', customerIo: 'erased' },
    }
    const service = resolvedService(result)

    const response = await eraseRequest(createRoute(service))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(result)
    expect(service.erase).toHaveBeenCalledWith(userId)
  })

  it('returns 202 with Retry-After while BigQuery data is pending', async () => {
    const result: PrivacyErasureResult = {
      status: 'pending',
      retryAfterSeconds: 2100,
      destinations: { bigQuery: 'pending', customerIo: 'erased' },
    }

    const response = await eraseRequest(createRoute(resolvedService(result)))

    expect(response.status).toBe(202)
    expect(response.headers.get('retry-after')).toBe('2100')
    await expect(response.json()).resolves.toEqual(result)
  })

  it('returns a sanitized 503 when a destination fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const service = { erase: vi.fn().mockRejectedValue(new PrivacyErasureError(['bigQuery'])) }

    const response = await eraseRequest(createRoute(service))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Privacy erasure is temporarily unavailable',
      type: 'service_unavailable',
    })
    expect(consoleError).toHaveBeenCalledWith('Privacy erasure failed', {
      errorType: 'PrivacyErasureError',
      failedDestinations: ['bigQuery'],
    })
  })

  it('returns 503 when erasure destinations are not configured', async () => {
    const response = await eraseRequest(createRoute(null))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Privacy erasure is not configured',
      type: 'configuration_error',
    })
  })
})
