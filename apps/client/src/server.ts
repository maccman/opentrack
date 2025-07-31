// Server-safe Analytics implementation
// This provides a no-op implementation for server-side rendering environments

import type { AnalyticsOptions, User } from './types'

// Server-safe Analytics class that provides the same API but does nothing
class ServerAnalytics {
  constructor(_options: AnalyticsOptions = {}) {
    // No-op constructor for server environments
  }

  // Initialization
  load(_writeKey?: string, _options?: AnalyticsOptions): void {
    // No-op for server
  }

  ready(callback: () => void): void {
    // Execute callback immediately in server environments
    if (typeof callback === 'function') {
      callback()
    }
  }

  // Core tracking methods - all no-ops on server
  track(_event: string, _properties?: Record<string, unknown>, _options?: Record<string, unknown>): void {
    // No-op for server
  }

  identify(_userId?: string, _traits?: Record<string, unknown>, _options?: Record<string, unknown>): void {
    // No-op for server
  }

  page(
    _category?: string,
    _name?: string,
    _properties?: Record<string, unknown>,
    _options?: Record<string, unknown>
  ): void {
    // No-op for server
  }

  group(_groupId: string, _traits?: Record<string, unknown>, _options?: Record<string, unknown>): void {
    // No-op for server
  }

  alias(_userId: string, _previousId?: string, _options?: Record<string, unknown>): void {
    // No-op for server
  }

  // User identity management
  user(): User {
    return {
      id: () => null,
      anonymousId: () => 'server-anonymous-id',
      traits: () => ({}),
    }
  }

  reset(): void {
    // No-op for server
  }

  // Queue and flush management
  flush(): void {
    // No-op for server
  }
}

// Create server analytics instance
const analytics = new ServerAnalytics()

export default analytics
export { ServerAnalytics }
