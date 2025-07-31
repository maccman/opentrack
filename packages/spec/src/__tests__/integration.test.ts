import { describe, expect, test } from 'vitest'

import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '../index'

describe('Integration Interface', () => {
  test('should define all required methods', () => {
    // Mock implementation of Integration interface
    const mockIntegration: Integration = {
      name: 'Test Integration',
      track: (_payload: TrackPayload) => Promise.resolve(),
      identify: (_payload: IdentifyPayload) => Promise.resolve(),
      page: (_payload: PagePayload) => Promise.resolve(),
      group: (_payload: GroupPayload) => Promise.resolve(),
      alias: (_payload: AliasPayload) => Promise.resolve(),
    }

    expect(mockIntegration.name).toBe('Test Integration')
    expect(typeof mockIntegration.track).toBe('function')
    expect(typeof mockIntegration.identify).toBe('function')
    expect(typeof mockIntegration.page).toBe('function')
    expect(typeof mockIntegration.group).toBe('function')
    expect(typeof mockIntegration.alias).toBe('function')
  })

  test('should define IntegrationConstructor with static isEnabled', () => {
    // Mock implementation of IntegrationConstructor
    class MockIntegration implements Integration {
      name = 'Test Integration'
      static isEnabled(): boolean {
        return true
      }
      track = (_payload: TrackPayload) => Promise.resolve()
      identify = (_payload: IdentifyPayload) => Promise.resolve()
      page = (_payload: PagePayload) => Promise.resolve()
      group = (_payload: GroupPayload) => Promise.resolve()
      alias = (_payload: AliasPayload) => Promise.resolve()
    }

    expect(typeof MockIntegration.isEnabled).toBe('function')
    expect(MockIntegration.isEnabled()).toBe(true)
  })

  test('should accept proper payload types for each method', async () => {
    const mockIntegration: Integration = {
      name: 'Test Integration',
      track: (payload: TrackPayload) => {
        expect(payload.type).toBe('track')
        expect(payload.event).toBeDefined()
        expect(payload.userId || payload.anonymousId).toBeDefined()
        return Promise.resolve()
      },
      identify: (payload: IdentifyPayload) => {
        expect(payload.type).toBe('identify')
        expect(payload.userId || payload.anonymousId).toBeDefined()
        return Promise.resolve()
      },
      page: (payload: PagePayload) => {
        expect(payload.type).toBe('page')
        expect(payload.userId || payload.anonymousId).toBeDefined()
        return Promise.resolve()
      },
      group: (payload: GroupPayload) => {
        expect(payload.type).toBe('group')
        expect(payload.groupId).toBeDefined()
        expect(payload.userId || payload.anonymousId).toBeDefined()
        return Promise.resolve()
      },
      alias: (payload: AliasPayload) => {
        expect(payload.type).toBe('alias')
        expect(payload.userId).toBeDefined()
        expect(payload.previousId).toBeDefined()
        return Promise.resolve()
      },
    }

    // Test each method with proper payloads
    await mockIntegration.track({
      type: 'track',
      event: 'Test Event',
      userId: 'user123',
    })

    await mockIntegration.identify({
      type: 'identify',
      userId: 'user123',
    })

    await mockIntegration.page({
      type: 'page',
      userId: 'user123',
    })

    await mockIntegration.group({
      type: 'group',
      userId: 'user123',
      groupId: 'group123',
    })

    await mockIntegration.alias({
      type: 'alias',
      userId: 'user123',
      previousId: 'anon123',
    })
  })

  test('should handle disabled integrations via static method', () => {
    class DisabledIntegration implements Integration {
      name = 'Disabled Integration'
      static isEnabled(): boolean {
        return false
      }
      track = (_payload: TrackPayload) => {
        throw new Error('Should not be called when disabled')
      }
      identify = (_payload: IdentifyPayload) => {
        throw new Error('Should not be called when disabled')
      }
      page = (_payload: PagePayload) => {
        throw new Error('Should not be called when disabled')
      }
      group = (_payload: GroupPayload) => {
        throw new Error('Should not be called when disabled')
      }
      alias = (_payload: AliasPayload) => {
        throw new Error('Should not be called when disabled')
      }
    }

    expect(DisabledIntegration.isEnabled()).toBe(false)
  })

  test('should support complex integration scenarios', async () => {
    let initCalled = false
    let eventsProcessed: string[] = []

    const complexIntegration: Integration = {
      name: 'Complex Integration',
      init: () => Promise.resolve(),
      track: (payload: TrackPayload) => {
        eventsProcessed.push(`track:${payload.event}`)
        return Promise.resolve()
      },
      identify: (payload: IdentifyPayload) => {
        eventsProcessed.push(`identify:${payload.userId || payload.anonymousId}`)
        return Promise.resolve()
      },
      page: (payload: PagePayload) => {
        eventsProcessed.push(`page:${payload.name || 'unnamed'}`)
        return Promise.resolve()
      },
      group: (payload: GroupPayload) => {
        eventsProcessed.push(`group:${payload.groupId}`)
        return Promise.resolve()
      },
      alias: (payload: AliasPayload) => {
        eventsProcessed.push(`alias:${payload.previousId}->${payload.userId}`)
        return Promise.resolve()
      },
    }

    // Initialize
    await complexIntegration.init?.()
    expect(initCalled).toBe(true)

    // Process various events
    await complexIntegration.track({
      type: 'track',
      event: 'Purchase Completed',
      userId: 'user123',
      properties: { value: 99.99 },
    })

    await complexIntegration.identify({
      type: 'identify',
      userId: 'user123',
      traits: { email: 'user@example.com' },
    })

    await complexIntegration.page({
      type: 'page',
      name: 'Product Detail',
      userId: 'user123',
    })

    await complexIntegration.group({
      type: 'group',
      userId: 'user123',
      groupId: 'company123',
      traits: { name: 'Example Corp' },
    })

    await complexIntegration.alias({
      type: 'alias',
      userId: 'user123',
      previousId: 'anon456',
    })

    expect(eventsProcessed).toEqual([
      'track:Purchase Completed',
      'identify:user123',
      'page:Product Detail',
      'group:company123',
      'alias:anon456->user123',
    ])
  })

  test('should handle error cases gracefully', async () => {
    const errorIntegration: Integration = {
      name: 'Error Integration',
      track: (_payload: TrackPayload) => {
        throw new Error('Track failed')
      },
      identify: (_payload: IdentifyPayload) => {
        throw new Error('Identify failed')
      },
      page: (_payload: PagePayload) => {
        throw new Error('Page failed')
      },
      group: (_payload: GroupPayload) => {
        throw new Error('Group failed')
      },
      alias: (_payload: AliasPayload) => {
        throw new Error('Alias failed')
      },
    }

    // Test that methods can throw errors
    await expect(
      errorIntegration.track({
        type: 'track',
        event: 'Test',
        userId: 'user123',
      })
    ).rejects.toThrow('Track failed')

    await expect(
      errorIntegration.identify({
        type: 'identify',
        userId: 'user123',
      })
    ).rejects.toThrow('Identify failed')

    await expect(
      errorIntegration.page({
        type: 'page',
        userId: 'user123',
      })
    ).rejects.toThrow('Page failed')

    await expect(
      errorIntegration.group({
        type: 'group',
        userId: 'user123',
        groupId: 'group123',
      })
    ).rejects.toThrow('Group failed')

    await expect(
      errorIntegration.alias({
        type: 'alias',
        userId: 'user123',
        previousId: 'anon123',
      })
    ).rejects.toThrow('Alias failed')
  })
})
