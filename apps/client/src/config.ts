// Default Configuration

import type { AnalyticsOptions } from './types'

export const DEFAULT_CONFIG: Required<AnalyticsOptions> = {
  writeKey: '',
  host: 'http://localhost:3000',
  flushAt: 20,
  flushInterval: 10000, // 10 seconds
  debug: false,
  storagePrefix: 'analytics_',
  userIdKey: 'analytics_user_id',
  anonymousIdKey: 'analytics_anonymous_id',
  traitsKey: 'analytics_traits',
}

/**
 * Merges user options with defaults
 */
export function createConfig(options: AnalyticsOptions = {}): Required<AnalyticsOptions> {
  const config = { ...DEFAULT_CONFIG, ...options }

  // If a custom storage prefix is provided, update the key names
  if (options.storagePrefix && options.storagePrefix !== DEFAULT_CONFIG.storagePrefix) {
    const prefix = options.storagePrefix
    config.userIdKey = options.userIdKey || `${prefix}user_id`
    config.anonymousIdKey = options.anonymousIdKey || `${prefix}anonymous_id`
    config.traitsKey = options.traitsKey || `${prefix}traits`
  }

  return config
}
