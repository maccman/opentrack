// Context Building Utilities

import type { CampaignInfo, ContextInfo } from '../types'

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

const UTM_TO_CAMPAIGN_KEY: Record<string, keyof CampaignInfo> = {
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'name',
  utm_term: 'term',
  utm_content: 'content',
}

export function getUtmParams(): Record<string, string> {
  const isBrowser = typeof window !== 'undefined'
  if (!isBrowser) {
    return {}
  }

  const urlParams = new URLSearchParams(window.location.search)
  const params: Record<string, string> = {}

  for (const key of UTM_PARAMS) {
    const value = urlParams.get(key)
    if (value) {
      params[key] = value
    }
  }

  return params
}

function buildCampaign(utmParams: Record<string, string>): CampaignInfo | undefined {
  const campaign: Partial<CampaignInfo> = {}
  let hasValue = false

  for (const [utmKey, value] of Object.entries(utmParams)) {
    const campaignKey = UTM_TO_CAMPAIGN_KEY[utmKey]
    if (campaignKey) {
      campaign[campaignKey] = value
      hasValue = true
    }
  }

  return hasValue ? campaign : undefined
}

/**
 * Builds the context object with browser and page information
 * Safely handles server environments where browser globals are not available
 */
export function buildContext(): ContextInfo {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
  const utmParams = getUtmParams()
  const campaign = buildCampaign(utmParams)

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
    ...(campaign ? { campaign } : {}),
  }
}

/**
 * Builds page properties with automatic capture of common fields
 * Safely handles server environments where browser globals are not available
 */
export function buildPageProperties(customProperties?: Record<string, unknown>): Record<string, unknown> {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
  const utmParams = getUtmParams()

  return {
    url: isBrowser ? window.location.href : '',
    title: isBrowser ? document.title : '',
    referrer: isBrowser ? document.referrer : '',
    path: isBrowser ? window.location.pathname : '',
    search: isBrowser ? window.location.search : '',
    ...utmParams,
    ...customProperties,
  }
}
