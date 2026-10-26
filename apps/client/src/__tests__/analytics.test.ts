import { afterEach, describe, expect, it, vi } from 'vitest'

type Listener = () => void

/**
 * Loads a fresh analytics singleton against minimal browser globals and
 * captures every beacon it sends.
 */
async function loadAnalytics() {
  const windowListeners = new Map<string, Listener[]>()
  const documentListeners = new Map<string, Listener[]>()
  const store = new Map<string, string>()
  const blobs: Blob[] = []

  function addListener(listeners: Map<string, Listener[]>) {
    return (name: string, listener: Listener) => {
      listeners.set(name, [...(listeners.get(name) ?? []), listener])
    }
  }

  const fakeDocument = {
    title: 'Home',
    referrer: '',
    visibilityState: 'visible',
    addEventListener: addListener(documentListeners),
  }

  vi.stubGlobal('window', {
    location: { href: 'https://site.test/home', search: '', pathname: '/home' },
    screen: { width: 1280, height: 720 },
    setTimeout: globalThis.setTimeout,
    addEventListener: addListener(windowListeners),
  })
  vi.stubGlobal('document', fakeDocument)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
  vi.stubGlobal('navigator', {
    userAgent: 'test-agent',
    sendBeacon: (_url: string, blob: Blob) => {
      blobs.push(blob)
      return true
    },
  })

  vi.resetModules()
  const { default: analytics } = await import('../analytics')

  return {
    analytics,
    sentPayloads: async (): Promise<Array<Record<string, unknown>>> => {
      const bodies = await Promise.all(blobs.map((blob) => blob.text()))
      return bodies.map((body) => JSON.parse(body) as Record<string, unknown>)
    },
    beaconCount: () => blobs.length,
    fireWindowEvent: (name: string) => windowListeners.get(name)?.forEach((listener) => listener()),
    fireDocumentEvent: (name: string) => documentListeners.get(name)?.forEach((listener) => listener()),
    setVisibility: (state: 'visible' | 'hidden') => {
      fakeDocument.visibilityState = state
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('sending', () => {
  it('sends each event as soon as load() has run', async () => {
    const { analytics, beaconCount } = await loadAnalytics()

    analytics.load('test-key')
    analytics.track('Clicked')
    expect(beaconCount()).toBe(1)

    analytics.track('Clicked Again')
    expect(beaconCount()).toBe(2)
  })

  it('holds events fired before load() and sends them with its write key', async () => {
    const { analytics, beaconCount, sentPayloads } = await loadAnalytics()

    analytics.track('Clicked')
    expect(beaconCount()).toBe(0)

    analytics.load('test-key')
    expect(beaconCount()).toBe(1)

    const [event] = await sentPayloads()
    expect(event.event).toBe('Clicked')
    expect(event.writeKey).toBe('test-key')
  })

  it('sends held events with the default config when load() is never called', async () => {
    vi.useFakeTimers()
    const { analytics, beaconCount } = await loadAnalytics()

    analytics.track('Clicked')
    vi.advanceTimersByTime(9999)
    expect(beaconCount()).toBe(0)

    vi.advanceTimersByTime(1)
    expect(beaconCount()).toBe(1)

    // The default configuration is now final, so later events go out at once
    analytics.track('Clicked Again')
    expect(beaconCount()).toBe(2)
  })
})

describe('page', () => {
  it('treats a lone string as the page name', async () => {
    const { analytics, sentPayloads } = await loadAnalytics()
    analytics.load()

    analytics.page('Pricing')

    const [page] = await sentPayloads()
    expect(page.name).toBe('Pricing')
    expect(page.category).toBeUndefined()
  })

  it('reads two strings as category then name', async () => {
    const { analytics, sentPayloads } = await loadAnalytics()
    analytics.load()

    analytics.page('Docs', 'Getting Started')

    const [page] = await sentPayloads()
    expect(page.category).toBe('Docs')
    expect(page.name).toBe('Getting Started')
  })

  it('reads a string and an object as name then properties', async () => {
    const { analytics, sentPayloads } = await loadAnalytics()
    analytics.load()

    analytics.page('Pricing', { plan: 'pro' } as unknown as string)

    const [page] = await sentPayloads()
    expect(page.name).toBe('Pricing')
    expect(page.category).toBeUndefined()
    expect(page.properties).toMatchObject({ plan: 'pro', path: '/home' })
  })
})

describe('identify', () => {
  it('sends traits captured before identification with the identified call', async () => {
    const { analytics, sentPayloads } = await loadAnalytics()
    analytics.load()

    analytics.identify({ email: 'lead@example.com' } as unknown as string)
    analytics.identify('user-1', { plan: 'pro' })

    const [, identified] = await sentPayloads()
    expect(identified.userId).toBe('user-1')
    expect(identified.traits).toEqual({ email: 'lead@example.com', plan: 'pro' })
  })

  it("does not carry one user's traits over to a different user", async () => {
    const { analytics, sentPayloads } = await loadAnalytics()
    analytics.load()

    analytics.identify('user-1', { email: 'one@example.com' })
    analytics.identify('user-2', { plan: 'free' })

    const [, second] = await sentPayloads()
    expect(second.userId).toBe('user-2')
    expect(second.traits).toEqual({ plan: 'free' })
    expect(analytics.user().traits()).toEqual({ plan: 'free' })
  })
})

describe('when the page goes away before load()', () => {
  it('sends held events when the page becomes hidden', async () => {
    const { analytics, beaconCount, fireDocumentEvent, setVisibility } = await loadAnalytics()

    analytics.track('Clicked')
    fireDocumentEvent('visibilitychange')
    expect(beaconCount()).toBe(0)

    setVisibility('hidden')
    fireDocumentEvent('visibilitychange')
    expect(beaconCount()).toBe(1)
  })

  it('sends held events on pagehide', async () => {
    const { analytics, beaconCount, fireWindowEvent } = await loadAnalytics()

    analytics.track('Clicked')
    fireWindowEvent('pagehide')

    expect(beaconCount()).toBe(1)
  })
})
