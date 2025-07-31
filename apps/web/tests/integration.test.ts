import Analytics from 'analytics-node'
import { $fetch } from 'nitro-test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('Analytics Integration Tests', () => {
  let analytics: Analytics

  // Helper function to create Analytics client pointing to test server
  const createAnalyticsClient = () => {
    // Get the base URL from nitro-test-utils (usually http://localhost:3000)
    const baseURL = 'http://localhost:3000'
    return new Analytics('test-write-key', {
      host: baseURL,
      // Don't set path here - analytics-node will append /v1/<endpoint>
      flushAt: 1, // Send immediately for testing
      flushInterval: 10, // Short interval
    })
  }

  it('should handle track events', async () => {
    analytics = createAnalyticsClient()

    const trackData = {
      userId: 'test-user-123',
      event: 'Test Event',
      properties: {
        value: 100,
        currency: 'USD',
        category: 'test',
      },
      context: {
        library: {
          name: 'analytics-node',
          version: '6.2.0',
        },
      },
      timestamp: new Date(),
    }

    // Send track event using Analytics client
    const result = await new Promise((resolve, reject) => {
      analytics.track(trackData, (err: Error | null) => {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })

    expect(result).toBe(true)
  })

  it('should handle identify events', async () => {
    analytics = createAnalyticsClient()

    const identifyData = {
      userId: 'test-user-123',
      traits: {
        email: 'test@example.com',
        name: 'Test User',
        plan: 'premium',
      },
      context: {
        library: {
          name: 'analytics-node',
          version: '6.2.0',
        },
      },
      timestamp: new Date(),
    }

    const result = await new Promise((resolve, reject) => {
      analytics.identify(identifyData, (err: Error | null) => {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })

    expect(result).toBe(true)
  })

  it('should handle page events', async () => {
    analytics = createAnalyticsClient()

    const pageData = {
      userId: 'test-user-123',
      name: 'Test Page',
      properties: {
        title: 'Test Page Title',
        url: 'https://example.com/test',
        path: '/test',
      },
      context: {
        library: {
          name: 'analytics-node',
          version: '6.2.0',
        },
      },
      timestamp: new Date(),
    }

    const result = await new Promise((resolve, reject) => {
      analytics.page(pageData, (err: Error | null) => {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })

    expect(result).toBe(true)
  })

  it('should handle group events', async () => {
    analytics = createAnalyticsClient()

    const groupData = {
      userId: 'test-user-123',
      groupId: 'test-group-456',
      traits: {
        name: 'Test Group',
        industry: 'Technology',
        employees: 50,
      },
      context: {
        library: {
          name: 'analytics-node',
          version: '6.2.0',
        },
      },
      timestamp: new Date(),
    }

    const result = await new Promise((resolve, reject) => {
      analytics.group(groupData, (err: Error | null) => {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })

    expect(result).toBe(true)
  })

  it('should handle alias events', async () => {
    analytics = createAnalyticsClient()

    const aliasData = {
      userId: 'test-user-123',
      previousId: 'anonymous-user-789',
      context: {
        library: {
          name: 'analytics-node',
          version: '6.2.0',
        },
      },
      timestamp: new Date(),
    }

    const result = await new Promise((resolve, reject) => {
      analytics.alias(aliasData, (err: Error | null) => {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })

    expect(result).toBe(true)
  })

  it('should reject invalid payloads', async () => {
    const invalidTrackData = {
      // Missing required userId
      event: 'Invalid Event',
      type: 'track',
    }

    // Test the endpoint directly to ensure validation works
    const response = await $fetch('/v1/track', {
      method: 'POST',
      body: invalidTrackData,
    })

    expect(response.status).toBe(400)
    expect(response.data).toHaveProperty('error')
  })

  it('should handle direct API calls to all endpoints', async () => {
    // Test all endpoints directly using $fetch
    const basePayload = {
      userId: 'test-user-direct',
      timestamp: new Date(),
      context: {
        library: { name: 'test', version: '1.0.0' },
      },
    }

    // Test track endpoint
    const trackResponse = await $fetch('/v1/track', {
      method: 'POST',
      body: {
        ...basePayload,
        event: 'Direct Test Event',
        type: 'track',
      },
    })
    expect(trackResponse.status).toBe(200)
    expect(trackResponse.data).toEqual({ success: true })

    // Test identify endpoint
    const identifyResponse = await $fetch('/v1/identify', {
      method: 'POST',
      body: {
        ...basePayload,
        traits: { email: 'direct@test.com' },
        type: 'identify',
      },
    })
    expect(identifyResponse.status).toBe(200)
    expect(identifyResponse.data).toEqual({ success: true })

    // Test page endpoint
    const pageResponse = await $fetch('/v1/page', {
      method: 'POST',
      body: {
        ...basePayload,
        name: 'Direct Test Page',
        type: 'page',
      },
    })
    expect(pageResponse.status).toBe(200)
    expect(pageResponse.data).toEqual({ success: true })

    // Test group endpoint
    const groupResponse = await $fetch('/v1/group', {
      method: 'POST',
      body: {
        ...basePayload,
        groupId: 'direct-test-group',
        type: 'group',
      },
    })
    expect(groupResponse.status).toBe(200)
    expect(groupResponse.data).toEqual({ success: true })

    // Test alias endpoint
    const aliasResponse = await $fetch('/v1/alias', {
      method: 'POST',
      body: {
        ...basePayload,
        previousId: 'direct-previous-id',
        type: 'alias',
      },
    })
    expect(aliasResponse.status).toBe(200)
    expect(aliasResponse.data).toEqual({ success: true })
  })
})
