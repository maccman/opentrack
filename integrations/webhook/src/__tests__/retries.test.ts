import type { TrackPayload } from '@app/spec'
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WebhookIntegration } from '../index'
import { WebhookErrorHandler } from '../utils'

// Unlike index.test.ts this uses a real axios instance, so the integration's
// interceptors run exactly as they do in production; only the transport is faked.

const payload: TrackPayload = { type: 'track', event: 'Order Completed', anonymousId: 'anon123' }

function respondWith(statuses: number[]): { adapter: AxiosAdapter; attempts: () => number } {
  let attempts = 0
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const status = statuses[Math.min(attempts, statuses.length - 1)]
    attempts++
    const response: AxiosResponse = { status, statusText: String(status), headers: {}, config, data: {} }
    if (status < 400) {
      return Promise.resolve(response)
    }
    return Promise.reject(
      new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, null, response)
    )
  }
  return { adapter, attempts: () => attempts }
}

function createIntegration(adapter: AxiosAdapter): WebhookIntegration {
  const integration = new WebhookIntegration({ url: 'https://webhook.example.com/events', retryAttempts: 2 })
  // @ts-expect-error the axios client is private; swap only its transport
  integration.client.defaults.adapter = adapter
  return integration
}

describe('WebhookIntegration retries', () => {
  beforeEach(() => {
    vi.spyOn(WebhookErrorHandler, 'getRetryDelay').mockReturnValue(0)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([429, 500, 502, 503, 504])('retries HTTP %i responses', async (status) => {
    const { adapter, attempts } = respondWith([status])

    await expect(createIntegration(adapter).track(payload)).rejects.toThrow()
    expect(attempts()).toBe(3)
  })

  it('delivers the event once a retry succeeds', async () => {
    const { adapter, attempts } = respondWith([503, 200])

    await expect(createIntegration(adapter).track(payload)).resolves.toBeUndefined()
    expect(attempts()).toBe(2)
  })

  it('does not retry client errors', async () => {
    const { adapter, attempts } = respondWith([400])

    await expect(createIntegration(adapter).track(payload)).rejects.toThrow('Bad Request')
    expect(attempts()).toBe(1)
  })

  it('retries requests that time out', async () => {
    let attempts = 0
    const adapter: AxiosAdapter = (config) => {
      attempts++
      return Promise.reject(new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED', config))
    }

    await expect(createIntegration(adapter).track(payload)).rejects.toThrow()
    expect(attempts).toBe(3)
  })
})
