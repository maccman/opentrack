import { afterEach, describe, expect, it, vi } from 'vitest'

import { KEEPALIVE_BYTE_LIMIT } from '@/utils'

import { openPage, settle } from './fake-browser'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function beaconedEventNames(beacons: Array<{ body: Record<string, unknown> }>): unknown[] {
  return beacons.flatMap((beacon) => (beacon.body.batch as Array<Record<string, unknown>>).map((event) => event.event))
}

describe('delivery confirmation and retries', () => {
  it('sends with a keepalive fetch that carries the write key header and no credentials', async () => {
    const page = await openPage()
    page.analytics.load('test-key')

    page.analytics.track('Clicked')

    expect(page.requests).toEqual([
      expect.objectContaining({
        url: '/v1/track',
        keepalive: true,
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa('test-key:')}` },
      }),
    ])
    expect(page.beaconCount()).toBe(0)
  })

  it('retries a 5xx with backoff until the server accepts the event', async () => {
    vi.useFakeTimers()
    const page = await openPage()
    page.analytics.load('test-key')
    page.respondWith(503, 502)

    page.analytics.track('Clicked')
    await settle()
    expect(page.requests).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(page.requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(page.requests).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(page.requests).toHaveLength(3)

    // Delivered, so there is nothing left to beacon
    page.fireWindowEvent('pagehide')
    expect(page.beaconCount()).toBe(0)
  })

  it('retries 429s and network errors', async () => {
    vi.useFakeTimers()
    const page = await openPage()
    page.analytics.load('test-key')
    page.respondWith(429, 'network-error')

    page.analytics.track('Clicked')
    await vi.advanceTimersByTimeAsync(3000)

    expect(page.requests).toHaveLength(3)
  })

  it('drops an event refused with a 4xx, without retrying or beaconing it', async () => {
    vi.useFakeTimers()
    const page = await openPage()
    page.analytics.load('test-key')
    page.respondWith(400)

    page.analytics.track('Clicked')
    await vi.advanceTimersByTimeAsync(10000)
    page.fireWindowEvent('pagehide')

    expect(page.requests).toHaveLength(1)
    expect(page.beaconCount()).toBe(0)
  })

  it('stops after the configured retries when every attempt fails', async () => {
    vi.useFakeTimers()
    const page = await openPage()
    page.analytics.load('test-key')
    page.respondByDefault(503)

    page.analytics.track('Clicked')
    await vi.advanceTimersByTimeAsync(10000)

    // The first attempt and the default two retries
    expect(page.requests).toHaveLength(3)
  })
})

describe('sendBeacon', () => {
  it('is never used while the page is visible, even when sending fails', async () => {
    const page = await openPage()
    page.analytics.load('test-key', { retries: 0 })
    page.respondByDefault('network-error')

    page.analytics.track('Clicked')
    page.analytics.track('Clicked Again')
    await settle()

    expect(page.requests).toHaveLength(2)
    expect(page.beaconCount()).toBe(0)
  })

  it('leaves requests still in flight to finish by keepalive when the page is hidden', async () => {
    const page = await openPage()
    page.analytics.load('test-key')
    page.respondWith('hang')

    page.analytics.track('Clicked')
    page.fireWindowEvent('pagehide')

    expect(page.beaconCount()).toBe(0)
  })

  it('carries failed events on page hide, with the write key in the body, once', async () => {
    const page = await openPage()
    page.analytics.load('test-key', { retries: 0 })
    page.respondWith(503)

    page.analytics.track('Clicked')
    await settle()
    page.fireWindowEvent('pagehide')
    page.setVisibility('hidden')
    page.fireDocumentEvent('visibilitychange')

    const beacons = await page.beacons()
    expect(beacons).toHaveLength(1)
    expect(beacons[0].url).toBe('/v1/batch')
    expect(beacons[0].body.writeKey).toBe('test-key')
    expect(beaconedEventNames(beacons)).toEqual(['Clicked'])
  })

  it('tries again on the next page hide when the browser refuses a beacon', async () => {
    const page = await openPage()
    page.analytics.load('test-key', { retries: 0 })
    page.respondWith(503)
    page.analytics.track('Clicked')
    await settle()

    page.refuseBeacons(true)
    page.fireWindowEvent('pagehide')
    expect(page.beaconCount()).toBe(0)

    page.refuseBeacons(false)
    page.fireWindowEvent('pagehide')
    // Accepted, so the next hide has nothing left to send
    page.fireWindowEvent('pagehide')

    expect(beaconedEventNames(await page.beacons())).toEqual(['Clicked'])
  })

  it('carries an event waiting to retry, since no request is in flight for it', async () => {
    vi.useFakeTimers()
    const page = await openPage()
    page.analytics.load('test-key')
    page.respondWith(503)

    page.analytics.track('Clicked')
    await settle()
    page.fireWindowEvent('pagehide')

    expect(beaconedEventNames(await page.beacons())).toEqual(['Clicked'])
  })

  it('carries batch chunks not sent yet, but not the chunk in flight', async () => {
    const page = await openPage()
    for (let index = 0; index < 30; index++) {
      page.analytics.track(`Event ${index}`, { notes: 'x'.repeat(5 * 1024) })
    }
    page.respondWith('hang')

    page.analytics.load('test-key')
    page.fireWindowEvent('pagehide')

    const inFlight = page.sentEvents().map((event) => event.event)
    const beaconed = beaconedEventNames(await page.beacons())
    expect(inFlight.length).toBeGreaterThan(0)
    expect(beaconed.length).toBeGreaterThan(0)
    expect([...inFlight, ...beaconed]).toEqual(Array.from({ length: 30 }, (_, index) => `Event ${index}`))
  })

  it('does not send events again at load() once a beacon carried them', async () => {
    const page = await openPage()
    page.analytics.track('Landed')
    page.fireWindowEvent('pagehide')
    page.analytics.track('Clicked')

    page.analytics.load('test-key')

    expect(beaconedEventNames(await page.beacons())).toEqual(['Landed'])
    expect(page.sentEvents().map((event) => event.event)).toEqual(['Clicked'])
  })

  it('is not used when useBeacon is false', async () => {
    const page = await openPage()
    page.analytics.load('test-key', { retries: 0, useBeacon: false })
    page.respondWith(503)

    page.analytics.track('Clicked')
    await settle()
    page.fireWindowEvent('pagehide')

    expect(page.beaconCount()).toBe(0)
  })
})

describe('batching', () => {
  it('sends a large release as /v1/batch requests under 64 KB, one at a time and in order', async () => {
    const page = await openPage()
    for (let index = 0; index < 30; index++) {
      page.analytics.track(`Event ${index}`, { notes: 'x'.repeat(5 * 1024) })
    }

    page.analytics.load('test-key')
    expect(page.requests).toHaveLength(1)
    await settle()

    expect(page.requests.length).toBeGreaterThan(1)
    for (const request of page.requests) {
      expect(request.url).toBe('/v1/batch')
      expect(request.bytes).toBeLessThan(KEEPALIVE_BYTE_LIMIT)
      expect(request.keepalive).toBe(true)
    }
    expect(page.sentEvents().map((event) => event.event)).toEqual(
      Array.from({ length: 30 }, (_, index) => `Event ${index}`)
    )
  })
})
