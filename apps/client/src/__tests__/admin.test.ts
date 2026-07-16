import { describe, expect, it, vi } from 'vitest'

import { createRegulation, MAX_SUBJECT_IDS, RegulationRequestError } from '../admin'

const SECRET = 'a-sufficiently-long-server-secret-value'
const HOST = 'https://analytics.example.com'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function options(overrides: Record<string, unknown> = {}) {
  return {
    host: HOST,
    secret: SECRET,
    subjectIds: ['user_12345'],
    ...overrides,
  }
}

describe('createRegulation', () => {
  it('POSTs a DELETE_ONLY regulation with bearer authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        status: 'FINISHED',
        destinations: [
          { name: 'bigquery', status: 'FINISHED' },
          { name: 'customerio', status: 'FINISHED' },
        ],
      })
    )

    const result = await createRegulation(options({ fetch: fetchMock }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe('https://analytics.example.com/internal/v1/regulations')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(init.body as string)).toEqual({
      regulationType: 'DELETE_ONLY',
      subjectType: 'USER_ID',
      subjectIds: ['user_12345'],
    })

    expect(result).toEqual({
      regulationType: 'DELETE_ONLY',
      subjectType: 'USER_ID',
      status: 'FINISHED',
      destinations: [
        { name: 'bigquery', status: 'FINISHED' },
        { name: 'customerio', status: 'FINISHED' },
      ],
    })
  })

  it('surfaces RUNNING with the Retry-After hint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          202,
          { status: 'RUNNING', destinations: [{ name: 'bigquery', status: 'RUNNING' }] },
          { 'Retry-After': '1800' }
        )
      )

    const result = await createRegulation(options({ fetch: fetchMock }))

    expect(result.status).toBe('RUNNING')
    expect(result.retryAfterSeconds).toBe(1800)
  })

  it('falls back to a default retry hint when the header is missing or invalid', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(202, { status: 'RUNNING', destinations: [] }, { 'Retry-After': 'soon' }))

    const result = await createRegulation(options({ fetch: fetchMock }))

    expect(result.retryAfterSeconds).toBe(1800)
  })

  it('returns NOT_SUPPORTED, FAILED, and PARTIAL_SUCCESS results instead of throwing', async () => {
    for (const [httpStatus, status] of [
      [501, 'NOT_SUPPORTED'],
      [502, 'FAILED'],
      [502, 'PARTIAL_SUCCESS'],
    ] as const) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(httpStatus, { status, destinations: [] }))
      const result = await createRegulation(options({ fetch: fetchMock }))
      expect(result.status).toBe(status)
      expect(result.retryAfterSeconds).toBeUndefined()
    }
  })

  it('throws a typed error for rejected requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: 'Unauthorized', type: 'authentication_error' }))

    const promise = createRegulation(options({ fetch: fetchMock }))

    await expect(promise).rejects.toBeInstanceOf(RegulationRequestError)
    await promise.catch((error: RegulationRequestError) => {
      expect(error.status).toBe(401)
      expect(error.code).toBe('authentication_error')
      expect(error.message).toBe('Unauthorized')
    })
  })

  it('throws a typed error for unrecognized response bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }))

    await expect(createRegulation(options({ fetch: fetchMock }))).rejects.toMatchObject({
      name: 'RegulationRequestError',
      code: 'invalid_response',
    })
  })

  it('validates options locally without touching the network', async () => {
    const fetchMock = vi.fn()

    const invalidOptions = [
      options({ host: '' }),
      options({ secret: 'short' }),
      options({ secret: `${SECRET} with-whitespace` }),
      options({ subjectIds: [] }),
      options({ subjectIds: [''] }),
      options({ subjectIds: [' padded '] }),
      options({ subjectIds: ['line\nbreak'] }),
      options({ subjectIds: ['x'.repeat(256)] }),
      options({ subjectIds: Array.from({ length: MAX_SUBJECT_IDS + 1 }, (_, index) => `user_${index}`) }),
    ]

    for (const invalid of invalidOptions) {
      await expect(createRegulation({ ...invalid, fetch: fetchMock })).rejects.toBeInstanceOf(TypeError)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps subject ids out of local validation errors', async () => {
    const error = await createRegulation(options({ subjectIds: [' secret-user-id '], fetch: vi.fn() })).catch(
      (thrown: unknown) => thrown
    )

    expect(error).toBeInstanceOf(TypeError)
    expect((error as TypeError).message).not.toContain('secret-user-id')
  })

  it('refuses to run in a browser-like environment', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {})
    try {
      await expect(createRegulation(options({ fetch: vi.fn() }))).rejects.toThrow(/server-only/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
