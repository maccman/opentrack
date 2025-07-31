import { describe, expect, test } from 'vitest'
import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '../index'

describe('Integration Interface', () => {
  test('should define all required methods', () => {
    // Mock implementation of Integration interface
    const mockIntegration: Integration = {
      name: 'Test Integration',
      isEnabled: () => true,
      track: async (payload: TrackPayload) => {},
      identify: async (payload: IdentifyPayload) => {},
      page: async (payload: PagePayload) => {},
      group: async (payload: GroupPayload) => {},
      alias: async (payload: AliasPayload) => {},
    }

    expect(mockIntegration.name).toBe('Test Integration')
    expect(typeof mockIntegration.isEnabled).toBe('function')
    expect(typeof mockIntegration.track).toBe('function')
    expect(typeof mockIntegration.identify).toBe('function')
    expect(typeof mockIntegration.page).toBe('function')
    expect(typeof mockIntegration.group).toBe('function')
    expect(typeof mockIntegration.alias).toBe('function')
  })

  test('should support optional init method', () => {
    const integrationWithInit: Integration = {
      name: 'Test Integration',
      isEnabled: () => true,
      init: async () => {
        // Initialization logic
      },
      track: async (payload: TrackPayload) => {},
      identify: async (payload: IdentifyPayload) => {},
      page: async (payload: PagePayload) => {},
      group: async (payload: GroupPayload) => {},
      alias: async (payload: AliasPayload) => {},
    }

    expect(typeof integrationWithInit.init).toBe('function')

    const integrationWithoutInit: Integration = {
      name: 'Test Integration',
      isEnabled: () => true,
      track: async (payload: TrackPayload) => {},
      identify: async (payload: IdentifyPayload) => {},
      page: async (payload: PagePayload) => {},
      group: async (payload: GroupPayload) => {},
      alias: async (payload: AliasPayload) => {},
    }

    expect(integrationWithoutInit.init).toBeUndefined()
  })

  test('should accept proper payload types for each method', async () => {
    const mockIntegration: Integration = {
      name: 'Test Integration',
      isEnabled: () => true,
      track: async (payload: TrackPayload) => {
        expect(payload.type).toBe('track')
        expect(payload.event).toBeDefined()
        expect(payload.userId || payload.anonymousId).toBeDefined()
      },
      identify: async (payload: IdentifyPayload) => {
        expect(payload.type).toBe('identify')
        expect(payload.userId || payload.anonymousId).toBeDefined()
      },
      page: async (payload: PagePayload) => {
        expect(payload.type).toBe('page')
        expect(payload.userId || payload.anonymousId).toBeDefined()
      },
      group: async (payload: GroupPayload) => {
        expect(payload.type).toBe('group')
        expect(payload.groupId).toBeDefined()
        expect(payload.userId || payload.anonymousId).toBeDefined()
      },
      alias: async (payload: AliasPayload) => {
        expect(payload.type).toBe('alias')
        expect(payload.userId).toBeDefined()
        expect(payload.previousId).toBeDefined()
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

  test('should handle disabled integrations', () => {
    const disabledIntegration: Integration = {
      name: 'Disabled Integration',
      isEnabled: () => false,
      track: async (payload: TrackPayload) => {
        throw new Error('Should not be called when disabled')
      },
      identify: async (payload: IdentifyPayload) => {
        throw new Error('Should not be called when disabled')
      },
      page: async (payload: PagePayload) => {
        throw new Error('Should not be called when disabled')
      },
      group: async (payload: GroupPayload) => {
        throw new Error('Should not be called when disabled')
      },
      alias: async (payload: AliasPayload) => {
        throw new Error('Should not be called when disabled')
      },
    }

    expect(disabledIntegration.isEnabled()).toBe(false)
  })

  test('should support complex integration scenarios', async () => {
    let initCalled = false
    let eventsProcessed: string[] = []

    const complexIntegration: Integration = {
      name: 'Complex Integration',
      isEnabled: () => true,
      init: async () => {
        initCalled = true
      },
      track: async (payload: TrackPayload) => {
        eventsProcessed.push(`track:${payload.event}`)
      },
      identify: async (payload: IdentifyPayload) => {
        eventsProcessed.push(`identify:${payload.userId || payload.anonymousId}`)
      },
      page: async (payload: PagePayload) => {
        eventsProcessed.push(`page:${payload.name || 'unnamed'}`)
      },
      group: async (payload: GroupPayload) => {
        eventsProcessed.push(`group:${payload.groupId}`)
      },
      alias: async (payload: AliasPayload) => {
        eventsProcessed.push(`alias:${payload.previousId}->${payload.userId}`)
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
      isEnabled: () => true,
      track: async (payload: TrackPayload) => {
        throw new Error('Track failed')
      },
      identify: async (payload: IdentifyPayload) => {
        throw new Error('Identify failed')
      },
      page: async (payload: PagePayload) => {
        throw new Error('Page failed')
      },
      group: async (payload: GroupPayload) => {
        throw new Error('Group failed')
      },
      alias: async (payload: AliasPayload) => {
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
