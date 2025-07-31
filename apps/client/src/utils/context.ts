// Context Building Utilities

import type { ContextInfo } from '../types'

/**
 * Builds the context object with browser and page information
 */
export function buildContext(): ContextInfo {
  return {
    page: {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
    },
    userAgent: navigator.userAgent,
    library: {
      name: 'libroseg-analytics',
      version: '1.0.0',
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
    },
  }
}

/**
 * Builds page properties with automatic capture of common fields
 */
export function buildPageProperties(customProperties?: Record<string, unknown>): Record<string, unknown> {
  return {
    url: window.location.href,
    title: document.title,
    referrer: document.referrer,
    path: window.location.pathname,
    search: window.location.search,
    ...customProperties,
  }
}
