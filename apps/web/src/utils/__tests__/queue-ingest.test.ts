import type { TrackPayload } from '@app/spec'
import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setWriteKeyRouting } from '../ingest-routing'
import { queueIngest, queueIngestBatch } from '../queue-ingest'

const { hasIntegration, isSuppressed, process, waitUntil } = vi.hoisted(() => ({
  waitUntil: vi.fn(),
  hasIntegration: vi.fn(),
  isSuppressed: vi.fn(),
  process: vi.fn(),
}))

vi.mock('@vercel/functions', () => ({ waitUntil }))
vi.mock('@/integrations', () => ({
  integrationManager: { hasIntegration, isSuppressed, process },
}))

const payload: TrackPayload = {
  type: 'track',
  event: 'Product Used',
  userId: 'user-1',
}

function createEvent(): H3Event {
  return { context: {} } as H3Event
}

describe('queueIngest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasIntegration.mockReturnValue(true)
    isSuppressed.mockResolvedValue(false)
    process.mockResolvedValue([])
  })

  it('preflights suppression and queues only the source allowlist', async () => {
    const event = createEvent()
    setWriteKeyRouting(event, 'bigquery-only')

    await expect(queueIngest(event, payload)).resolves.toBe('queued')

    expect(isSuppressed).toHaveBeenCalledWith(payload)
    expect(process).toHaveBeenCalledWith(payload, {
      allowedIntegrationNames: ['BigQuery'],
      skipSuppressionCheck: true,
    })
    expect(waitUntil).toHaveBeenCalledWith(process.mock.results[0]?.value)
  })

  it('acknowledges a suppressed event without fan-out', async () => {
    isSuppressed.mockResolvedValue(true)

    await expect(queueIngest(createEvent(), payload)).resolves.toBe('suppressed')

    expect(process).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('fails closed when the source-authorized destination is not configured', async () => {
    const event = createEvent()
    setWriteKeyRouting(event, 'bigquery-only')
    hasIntegration.mockReturnValue(false)

    await expect(queueIngest(event, payload)).rejects.toMatchObject({
      statusCode: 503,
    })

    expect(hasIntegration).toHaveBeenCalledWith('BigQuery')
    expect(isSuppressed).not.toHaveBeenCalled()
    expect(process).not.toHaveBeenCalled()
  })

  it('returns a service-unavailable error when suppression cannot be checked', async () => {
    isSuppressed.mockRejectedValue(new Error('redis unavailable'))

    await expect(queueIngest(createEvent(), payload)).rejects.toMatchObject({ statusCode: 503 })
    expect(process).not.toHaveBeenCalled()
  })

  it('preflights the entire batch before queueing any delivery', async () => {
    const secondPayload: TrackPayload = {
      ...payload,
      event: 'Second Product Used',
    }
    isSuppressed.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('redis unavailable'))

    await expect(queueIngestBatch(createEvent(), [payload, secondPayload])).rejects.toMatchObject({ statusCode: 503 })

    expect(isSuppressed).toHaveBeenCalledTimes(2)
    expect(process).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
  })
})
