// Default Configuration

import type { AnalyticsOptions } from './types'

export const DEFAULT_CONFIG: Required<AnalyticsOptions> = {
  writeKey: '', // Not used
  host: '', // Defaults to the current domain
  flushAt: 20, // Deprecated: events are sent as they happen
  flushInterval: 10000, // Deprecated: events are sent as they happen
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
 * How long events fired before load() are held when load() is never called,
 * after which they're sent with the default configuration. It is fixed because
 * options only arrive through load(). Erring long is safe: held events are also
 * sent when the page is hidden or unloaded.
 */
export const PRE_LOAD_HOLD_MS = 10000

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
