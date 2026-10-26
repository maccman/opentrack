import { vi } from 'vitest'

type Listener = () => void

/** How the fake fetch answers: an HTTP status, a network error, or a request that never settles */
export type FakeResponse = number | 'network-error' | 'hang'

export interface SentRequest {
  url: string
  body: Record<string, unknown>
  bytes: number
  headers: Record<string, string>
  keepalive: boolean | undefined
  credentials: RequestCredentials | undefined
}

// Named so declaration emit refers to the singleton's type instead of inlining its private members
type Analytics = (typeof import('@/analytics'))['default']

export interface FakePage {
  analytics: Analytics
  requests: SentRequest[]
  /** Sets the answers to the next fetches, in order */
  respondWith: (...next: FakeResponse[]) => void
  /** Sets the answer to every fetch without a queued answer */
  respondByDefault: (response: FakeResponse) => void
  /** Every event sent with fetch, unpacking batches */
  sentEvents: () => Array<Record<string, unknown>>
  beaconCount: () => number
  /** Makes sendBeacon return false, as browsers do when too many bytes are in flight */
  refuseBeacons: (refuse: boolean) => void
  beacons: () => Promise<Array<{ url: string; body: Record<string, unknown> }>>
  fireWindowEvent: (name: string) => void
  fireDocumentEvent: (name: string) => void
  setVisibility: (state: 'visible' | 'hidden') => void
}

/** Lets pending promise callbacks, such as fetch responses, run */
export async function settle(): Promise<void> {
  for (let tick = 0; tick < 50; tick++) {
    await Promise.resolve()
  }
}

function addListener(listeners: Map<string, Listener[]>) {
  return (name: string, listener: Listener) => {
    listeners.set(name, [...(listeners.get(name) ?? []), listener])
  }
}

/**
 * Loads a fresh analytics singleton against minimal browser globals, as a new
 * page would, and records every fetch and beacon it sends
 */
export async function openPage(): Promise<FakePage> {
  const store = new Map<string, string>()
  const windowListeners = new Map<string, Listener[]>()
  const documentListeners = new Map<string, Listener[]>()
  const requests: SentRequest[] = []
  const beaconBlobs: Array<{ url: string; blob: Blob }> = []
  const responses: FakeResponse[] = []
  let defaultResponse: FakeResponse = 200
  let isRefusingBeacons = false

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
    sendBeacon: (url: string, blob: Blob) => {
      if (isRefusingBeacons) {
        return false
      }
      beaconBlobs.push({ url, blob })
      return true
    },
  })
  vi.stubGlobal('fetch', (url: string, init: { body: string; headers: Record<string, string> } & RequestInit) => {
    const body = init.body
    requests.push({
      url,
      body: JSON.parse(body) as Record<string, unknown>,
      bytes: new TextEncoder().encode(body).byteLength,
      headers: init.headers,
      keepalive: init.keepalive,
      credentials: init.credentials,
    })

    const response = responses.shift() ?? defaultResponse
    if (response === 'hang') {
      return new Promise<Response>(() => {})
    }
    if (response === 'network-error') {
      return Promise.reject(new TypeError('Failed to fetch'))
    }
    return Promise.resolve(new Response(null, { status: response }))
  })

  vi.resetModules()
  const { default: analytics } = await import('@/analytics')

  return {
    analytics,
    requests,
    respondWith: (...next) => {
      responses.push(...next)
    },
    respondByDefault: (response) => {
      defaultResponse = response
    },
    sentEvents: () =>
      requests.flatMap((request) =>
        request.url.endsWith('/v1/batch') ? (request.body.batch as Array<Record<string, unknown>>) : [request.body]
      ),
    beaconCount: () => beaconBlobs.length,
    refuseBeacons: (refuse) => {
      isRefusingBeacons = refuse
    },
    beacons: async () =>
      await Promise.all(
        beaconBlobs.map(async ({ url, blob }) => ({
          url,
          body: JSON.parse(await blob.text()) as Record<string, unknown>,
        }))
      ),
    fireWindowEvent: (name) => windowListeners.get(name)?.forEach((listener) => listener()),
    fireDocumentEvent: (name) => documentListeners.get(name)?.forEach((listener) => listener()),
    setVisibility: (state) => {
      fakeDocument.visibilityState = state
    },
  }
}
