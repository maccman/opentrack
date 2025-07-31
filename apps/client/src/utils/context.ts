// Context Building Utilities

import type { ContextInfo } from '../types'

/**
 * Builds the context object with browser and page information
 * Safely handles server environments where browser globals are not available
 */
export function buildContext(): ContextInfo {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

  return {
    page: {
      url: isBrowser ? window.location.href : '',
      title: isBrowser ? document.title : '',
      referrer: isBrowser ? document.referrer : '',
    },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    library: {
      name: 'opentrack-analytics',
      version: '1.0.0',
    },
    screen: {
      width: isBrowser && window.screen ? window.screen.width : 0,
      height: isBrowser && window.screen ? window.screen.height : 0,
    },
  }
}

/**
 * Builds page properties with automatic capture of common fields
 * Safely handles server environments where browser globals are not available
 */
export function buildPageProperties(customProperties?: Record<string, unknown>): Record<string, unknown> {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

  return {
    url: isBrowser ? window.location.href : '',
    title: isBrowser ? document.title : '',
    referrer: isBrowser ? document.referrer : '',
    path: isBrowser ? window.location.pathname : '',
    search: isBrowser ? window.location.search : '',
    ...customProperties,
  }
}
