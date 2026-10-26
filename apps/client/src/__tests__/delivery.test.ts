import { afterEach, describe, expect, it, vi } from 'vitest'

import { KEEPALIVE_BYTE_LIMIT } from '@/utils'

import { createFakeBrowser, settle } from './fake-browser'

const DAY_MS = 24 * 60 * 60 * 1000

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('delivery confirmation and retries', () => {
  it('sends with a keepalive fetch that carries the write key header and no credentials', async () => {
    const page = await createFakeBrowser().openPage()
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

  it('retries a 5xx with backoff until the server accepts the event, then forgets it', async () => {
    vi.useFakeTimers()
    const browser = createFakeBrowser()
    const page = await browser.openPage()
    page.analytics.load('test-key')
    page.respondWith(503, 502)

    page.analytics.track('Clicked')
    await settle()
    expect(page.requests).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(page.requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(page.requests).toHaveLength(2)
    expect(browser.queuedEventNames()).toEqual(['Clicked'])

    await vi.advanceTimersByTimeAsync(2000)
    expect(page.requests).toHaveLength(3)
    expect(browser.queuedEventNames()).toEqual([])
  })

  it('retries 429s and network errors', async () => {
    vi.useFakeTimers()
    const browser = createFakeBrowser()
    const page = await browser.openPage()
    page.analytics.load('test-key')
    page.respondWith(429, 'network-error')

    page.analytics.track('Clicked')
    await vi.advanceTimersByTimeAsync(3000)

    expect(page.requests).toHaveLength(3)
    expect(browser.queuedEventNames()).toEqual([])
  })

  it('does not retry a 4xx, and drops the event because a replay would be rejected too', async () => {
    vi.useFakeTimers()
    const browser = createFakeBrowser()
    const page = await browser.openPage()
    page.analytics.load('test-key')
    page.respondWith(400)

    page.analytics.track('Clicked')
    await vi.advanceTimersByTimeAsync(10000)

    expect(page.requests).toHaveLength(1)
    expect(browser.queuedEventNames()).toEqual([])
  })

  it('keeps the event queued when every attempt fails', async () => {
    vi.useFakeTimers()
    const browser = createFakeBrowser()
    const page = await browser.openPage()
    page.analytics.load('test-key')
    page.respondByDefault(503)

    page.analytics.track('Clicked')
    await vi.advanceTimersByTimeAsync(10000)

    // The first attempt and the default two retries
    expect(page.requests).toHaveLength(3)
    expect(browser.queuedEventNames()).toEqual(['Clicked'])
  })
})

describe('sendBeacon', () => {
  it('is never used while the page is visible, even when sending fails', async () => {
    const page = await createFakeBrowser().openPage()
    page.analytics.load('test-key', { retries: 0 })
    page.respondByDefault('network-error')

    page.analytics.track('Clicked')
    page.analytics.track('Clicked Again')
    await settle()

    expect(page.requests).toHaveLength(2)
    expect(page.beaconCount()).toBe(0)
  })

  it('leaves requests still in flight to finish by keepalive when the page is hidden', async () => {
    const page = await createFakeBrowser().openPage()
    page.analytics.load('test-key')
    page.respondWith('hang')

    page.analytics.track('Clicked')
    page.fireWindowEvent('pagehide')

    expect(page.beaconCount()).toBe(0)
  })

  it('carries failed events on page hide, with the write key in the body, once per page', async () => {
    const browser = createFakeBrowser()
    const page = await browser.openPage()
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
    expect(beacons[0].body.batch).toEqual([expect.objectContaining({ event: 'Clicked' })])
    // A beacon reports no status, so the event stays queued for replay
    expect(browser.queuedEventNames()).toEqual(['Clicked'])
  })

  it('carries an event waiting to retry, since no request is in flight for it', async () => {
    vi.useFakeTimers()
    const browser = createFakeBrowser()
    const page = await browser.openPage()
    page.analytics.load('test-key')
    page.respondWith(503)

    page.analytics.track('Clicked')
    await settle()
    page.fireWindowEvent('pagehide')

    const beacons = await page.beacons()
    expect(beacons).toHaveLength(1)
    expect(beacons[0].body.batch).toEqual([expect.objectContaining({ event: 'Clicked' })])
  })

  it('carries batch chunks not sent yet, but not the chunk in flight', async () => {
    const page = await createFakeBrowser().openPage()
    for (let index = 0; index < 30; index++) {
      page.analytics.track(`Event ${index}`, { notes: 'x'.repeat(5 * 1024) })
    }
    page.respondWith('hang')

    page.analytics.load('test-key')
    page.fireWindowEvent('pagehide')

    const inFlight = page.sentEvents().map((event) => event.event)
    const beaconed = (await page.beacons()).flatMap((beacon) =>
      (beacon.body.batch as Array<Record<string, unknown>>).map((event) => event.event)
    )
    expect(inFlight.length).toBeGreaterThan(0)
    expect(beaconed.length).toBeGreaterThan(0)
    expect([...inFlight, ...beaconed]).toEqual(Array.from({ length: 30 }, (_, index) => `Event ${index}`))
  })

  it('is not used when useBeacon is false', async () => {
    const browser = createFakeBrowser()
    const page = await browser.openPage()
    page.analytics.load('test-key', { retries: 0, useBeacon: false })
    page.respondWith(503)

    page.analytics.track('Clicked')
    await settle()
    page.fireWindowEvent('pagehide')

    expect(page.beaconCount()).toBe(0)
    expect(browser.queuedEventNames()).toEqual(['Clicked'])
  })
})

describe('replay after reload', () => {
  it('replays events an earlier page could not deliver, in one batch once load() runs', async () => {
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.analytics.load('test-key', { retries: 0 })
    first.respondWith('network-error')
    first.analytics.track('Landed')
    await settle()
    expect(browser.queuedEventNames()).toEqual(['Landed'])

    const second = await browser.openPage()
    second.analytics.page('Pricing')
    expect(second.requests).toHaveLength(0)

    second.analytics.load('test-key')
    expect(second.requests).toHaveLength(1)
    expect(second.requests[0].url).toBe('/v1/batch')
    expect(second.sentEvents().map((event) => event.event ?? event.name)).toEqual(['Landed', 'Pricing'])

    await settle()
    expect(browser.queuedEventNames()).toEqual([])
  })

  it('replays events that were in flight when the page closed', async () => {
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.analytics.load('test-key')
    first.respondWith('hang')
    first.analytics.track('Landed')

    const second = await browser.openPage()
    second.analytics.load('test-key')

    expect(second.sentEvents().map((event) => event.event)).toEqual(['Landed'])
  })

  it('replays events beaconed before load() ran, since the beacon was never confirmed', async () => {
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.analytics.track('Landed')
    first.fireWindowEvent('pagehide')
    expect(first.beaconCount()).toBe(1)

    const second = await browser.openPage()
    second.analytics.load('test-key')

    expect(second.sentEvents().map((event) => event.event)).toEqual(['Landed'])
  })

  it('keeps the original messageId, so destinations can dedupe a replay', async () => {
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.analytics.load('test-key')
    first.respondWith('hang')
    first.analytics.track('Landed')
    const [original] = first.sentEvents()

    const second = await browser.openPage()
    second.analytics.load('test-key')

    const [replayed] = second.sentEvents()
    expect(replayed.messageId).toBe(original.messageId)
    expect(replayed.timestamp).toBe(original.timestamp)
  })

  it('replays an event only to the host and write key it was meant for', async () => {
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.analytics.load('key-a', { host: 'https://a.test', retries: 0 })
    first.respondWith(503)
    first.analytics.track('For A')
    await settle()

    const other = await browser.openPage()
    other.analytics.load('key-b', { host: 'https://b.test' })
    other.fireWindowEvent('pagehide')
    expect(other.requests).toHaveLength(0)
    expect(other.beaconCount()).toBe(0)

    const same = await browser.openPage()
    same.analytics.load('key-a', { host: 'https://a.test' })
    expect(same.requests.map((request) => request.url)).toEqual(['https://a.test/v1/batch'])
    expect(same.sentEvents().map((event) => event.event)).toEqual(['For A'])
  })

  it('keeps the queue under the storagePrefix load() configures', async () => {
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.respondByDefault(503)
    first.analytics.track('Held')
    first.analytics.load('key-a', { storagePrefix: 'projectA_', retries: 0 })
    first.analytics.track('Clicked')
    await settle()

    expect(browser.queuedEventNames('projectA_queue')).toEqual(['Held', 'Clicked'])
    expect(browser.queuedEventNames()).toEqual([])

    const other = await browser.openPage()
    other.analytics.load('key-a', { storagePrefix: 'projectB_' })
    expect(other.requests).toHaveLength(0)

    const same = await browser.openPage()
    same.analytics.load('key-a', { storagePrefix: 'projectA_' })
    expect(same.sentEvents().map((event) => event.event)).toEqual(['Held', 'Clicked'])
  })

  it('does not replay events queued seven days ago or more', async () => {
    vi.useFakeTimers()
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.analytics.load('test-key', { retries: 0 })
    first.respondByDefault('network-error')
    first.analytics.track('Expired')
    await settle()
    vi.setSystemTime(Date.now() + DAY_MS)
    first.analytics.track('Recent')
    await settle()

    vi.setSystemTime(Date.now() + 6 * DAY_MS)
    const second = await browser.openPage()
    second.analytics.load('test-key')

    expect(second.sentEvents().map((event) => event.event)).toEqual(['Recent'])
  })

  it('keeps only the newest 100 events', async () => {
    const browser = createFakeBrowser()
    const first = await browser.openPage()
    first.analytics.load('test-key', { retries: 0 })
    first.respondByDefault('network-error')
    for (let index = 0; index < 105; index++) {
      first.analytics.track(`Event ${index}`)
    }
    await settle()

    const second = await browser.openPage()
    second.analytics.load('test-key')
    await settle()

    const replayed = second.sentEvents().map((event) => event.event)
    expect(replayed).toHaveLength(100)
    expect(replayed[0]).toBe('Event 5')
    expect(replayed[99]).toBe('Event 104')
  })

  it('keeps the queue under 256 KB by dropping the oldest events', async () => {
    const browser = createFakeBrowser()
    const page = await browser.openPage()
    page.analytics.load('test-key', { retries: 0 })
    page.respondByDefault('network-error')

    for (let index = 0; index < 10; index++) {
      page.analytics.track(`Event ${index}`, { notes: 'x'.repeat(40 * 1024) })
    }
    await settle()

    const queued = browser.queuedEventNames()
    expect(browser.queuedBytes()).toBeLessThanOrEqual(256 * 1024)
    expect(queued.length).toBeLessThan(10)
    expect(queued[queued.length - 1]).toBe('Event 9')
  })
})

describe('batching', () => {
  it('sends a large release as /v1/batch requests under 64 KB, one at a time and in order', async () => {
    const page = await createFakeBrowser().openPage()
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
