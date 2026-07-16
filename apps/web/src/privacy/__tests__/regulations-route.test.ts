import { createApp, toWebHandler } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRegulationsHandler, REGULATION_RETRY_AFTER_SECONDS } from '../../routes/internal/v1/regulations.post'
import type { RegulationResult } from '../regulation-service'

const endpoint = 'http://localhost/internal/v1/regulations'
const secret = process.env.OPENTRACK_SECRET as string
const validBody = {
  regulationType: 'DELETE_ONLY',
  subjectType: 'USER_ID',
  subjectIds: ['user_12345'],
}

function createRoute(result: RegulationResult | Error) {
  const service = {
    deleteUsers: result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result),
  }
  const app = createApp().use('/internal/v1/regulations', createRegulationsHandler(service))
  return { route: toWebHandler(app), service }
}

function request(
  route: ReturnType<typeof toWebHandler>,
  { body = validBody as unknown, headers = {} as Record<string, string> } = {}
) {
  return route(
    new Request(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  )
}

const finished: RegulationResult = {
  status: 'FINISHED',
  destinations: [
    { name: 'bigquery', status: 'FINISHED' },
    { name: 'customerio', status: 'FINISHED' },
  ],
}

describe('POST /internal/v1/regulations', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('executes a DELETE_ONLY regulation and echoes the regulation contract', async () => {
    const { route, service } = createRoute(finished)

    const response = await request(route)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      regulationType: 'DELETE_ONLY',
      subjectType: 'USER_ID',
      status: 'FINISHED',
      destinations: finished.destinations,
    })
    expect(service.deleteUsers).toHaveBeenCalledWith(['user_12345'])
  })

  it('returns 202 with Retry-After while a destination is still settling', async () => {
    const { route } = createRoute({
      status: 'RUNNING',
      destinations: [
        { name: 'bigquery', status: 'RUNNING' },
        { name: 'customerio', status: 'FINISHED' },
      ],
    })

    const response = await request(route)

    expect(response.status).toBe(202)
    expect(response.headers.get('retry-after')).toBe(String(REGULATION_RETRY_AFTER_SECONDS))
  })

  it('returns 501 when no configured destination supports deletion', async () => {
    const { route } = createRoute({
      status: 'NOT_SUPPORTED',
      destinations: [{ name: 'webhook', status: 'NOT_SUPPORTED' }],
    })

    const response = await request(route)
    expect(response.status).toBe(501)
  })

  it('returns 502 with per-destination statuses when deletion partially fails', async () => {
    const { route } = createRoute({
      status: 'PARTIAL_SUCCESS',
      destinations: [
        { name: 'bigquery', status: 'FAILED' },
        { name: 'customerio', status: 'FINISHED' },
      ],
    })

    const response = await request(route)

    expect(response.status).toBe(502)
    const body = (await response.json()) as { status: string }
    expect(body.status).toBe('PARTIAL_SUCCESS')
  })

  it('rejects requests without the bearer secret before touching the service', async () => {
    const { route, service } = createRoute(finished)

    const response = await request(route, { headers: { Authorization: 'Bearer wrong-secret' } })

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
    expect(service.deleteUsers).not.toHaveBeenCalled()
  })

  it('requires an application/json content type', async () => {
    const { route, service } = createRoute(finished)

    const response = await request(route, { headers: { 'Content-Type': 'text/plain' } })

    expect(response.status).toBe(415)
    expect(service.deleteUsers).not.toHaveBeenCalled()
  })

  it('explains that suppression-style regulations are unsupported', async () => {
    const { route, service } = createRoute(finished)

    const response = await request(route, { body: { ...validBody, regulationType: 'SUPPRESS_WITH_DELETE' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'OpenTrack is stateless and supports only DELETE_ONLY regulations',
      type: 'not_supported_error',
    })
    expect(service.deleteUsers).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies with a sanitized 400', async () => {
    const { route, service } = createRoute(finished)

    for (const body of [
      {},
      { ...validBody, subjectIds: [] },
      { ...validBody, subjectIds: ['ok', ''] },
      { ...validBody, extra: 'field' },
      'not-an-object',
    ]) {
      const response = await request(route, { body })
      expect(response.status).toBe(400)
    }
    expect(service.deleteUsers).not.toHaveBeenCalled()
  })

  it('returns a sanitized 503 when the regulation service throws unexpectedly', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { route } = createRoute(new Error('provider detail naming user_12345'))

    const response = await request(route)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Privacy regulations are temporarily unavailable',
      type: 'service_unavailable',
    })
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('user_12345')
  })
})
