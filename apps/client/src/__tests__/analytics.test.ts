import { afterEach, describe, expect, it, vi } from 'vitest'

import { openPage } from './fake-browser'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('sending', () => {
  it('sends each event as soon as load() has run', async () => {
    const { analytics, requests } = await openPage()

    analytics.load('test-key')
    analytics.track('Clicked')
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/v1/track')

    analytics.track('Clicked Again')
    expect(requests).toHaveLength(2)
  })

  it('contains events that cannot be serialized instead of rejecting globally', async () => {
    const { analytics, requests } = await openPage()
    analytics.load()
    const onUnhandledRejection = vi.fn()
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      analytics.track('Order Completed', { orderId: 123n })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onUnhandledRejection).not.toHaveBeenCalled()
      expect(requests).toHaveLength(0)
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('holds events fired before load() and sends them with its write key', async () => {
    const { analytics, requests, sentEvents } = await openPage()

    analytics.track('Clicked')
    expect(requests).toHaveLength(0)

    analytics.load('test-key')
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/v1/batch')
    expect(requests[0].headers.Authorization).toBe(`Basic ${btoa('test-key:')}`)
    expect(sentEvents().map((event) => event.event)).toEqual(['Clicked'])
  })

  it('sends held events with the default config when load() is never called', async () => {
    vi.useFakeTimers()
    const { analytics, requests } = await openPage()

    analytics.track('Clicked')
    vi.advanceTimersByTime(9999)
    expect(requests).toHaveLength(0)

    vi.advanceTimersByTime(1)
    expect(requests).toHaveLength(1)

    // The default configuration is now final, so later events go out at once
    analytics.track('Clicked Again')
    expect(requests).toHaveLength(2)
  })
})

describe('page', () => {
  it('treats a lone string as the page name', async () => {
    const { analytics, sentEvents } = await openPage()
    analytics.load()

    analytics.page('Pricing')

    const [page] = sentEvents()
    expect(page.name).toBe('Pricing')
    expect(page.category).toBeUndefined()
  })

  it('reads two strings as category then name', async () => {
    const { analytics, sentEvents } = await openPage()
    analytics.load()

    analytics.page('Docs', 'Getting Started')

    const [page] = sentEvents()
    expect(page.category).toBe('Docs')
    expect(page.name).toBe('Getting Started')
  })

  it('reads a string and an object as name then properties', async () => {
    const { analytics, sentEvents } = await openPage()
    analytics.load()

    analytics.page('Pricing', { plan: 'pro' } as unknown as string)

    const [page] = sentEvents()
    expect(page.name).toBe('Pricing')
    expect(page.category).toBeUndefined()
    expect(page.properties).toMatchObject({ plan: 'pro', path: '/home' })
  })
})

describe('identify', () => {
  it('sends traits captured before identification with the identified call', async () => {
    const { analytics, sentEvents } = await openPage()
    analytics.load()

    analytics.identify({ email: 'lead@example.com' } as unknown as string)
    analytics.identify('user-1', { plan: 'pro' })

    const [, identified] = sentEvents()
    expect(identified.userId).toBe('user-1')
    expect(identified.traits).toEqual({ email: 'lead@example.com', plan: 'pro' })
  })

  it("does not carry one user's traits over to a different user", async () => {
    const { analytics, sentEvents } = await openPage()
    analytics.load()

    analytics.identify('user-1', { email: 'one@example.com' })
    analytics.identify('user-2', { plan: 'free' })

    const [, second] = sentEvents()
    expect(second.userId).toBe('user-2')
    expect(second.traits).toEqual({ plan: 'free' })
    expect(analytics.user().traits()).toEqual({ plan: 'free' })
  })
})

describe('when the page goes away before load()', () => {
  it('beacons held events when the page becomes hidden', async () => {
    const { analytics, beaconCount, beacons, fireDocumentEvent, setVisibility } = await openPage()

    analytics.track('Clicked')
    fireDocumentEvent('visibilitychange')
    expect(beaconCount()).toBe(0)

    setVisibility('hidden')
    fireDocumentEvent('visibilitychange')
    expect(beaconCount()).toBe(1)

    const [beacon] = await beacons()
    expect(beacon.url).toBe('/v1/batch')
    expect(beacon.body.batch).toEqual([expect.objectContaining({ event: 'Clicked' })])
  })

  it('beacons held events on pagehide', async () => {
    const { analytics, beaconCount, fireWindowEvent } = await openPage()

    analytics.track('Clicked')
    fireWindowEvent('pagehide')

    expect(beaconCount()).toBe(1)
  })
})
