// Default Configuration

import type { AnalyticsOptions } from './types'

export const DEFAULT_CONFIG: Required<AnalyticsOptions> = {
  writeKey: '', // Not used
  host: '', // Defaults to the current domain
  flushAt: 20, // Flush after 20 events
  flushInterval: 10000, // Flush every 10 seconds
  debug: false, // Debug mode
  storagePrefix: 'analytics_', // Prefix for localStorage keys
  userIdKey: 'analytics_user_id', // localStorage key for user ID
  anonymousIdKey: 'analytics_anonymous_id', // localStorage key for anonymous ID
  traitsKey: 'analytics_traits', // localStorage key for user traits
  useBeacon: true, // Use sendBeacon by default for reliability
  timeout: 5000, // 5 second timeout
  retries: 2, // 2 retry attempts
  retryDelay: 1000, // 1 second base delay for retries
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
