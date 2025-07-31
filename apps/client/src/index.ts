// Main entry point - exports browser analytics implementation
// For server-safe usage, import from 'opentrack-analytics/server' instead

export { default } from './analytics'

// Re-export all types for TypeScript users
export type {
  AliasPayload,
  AnalyticsOptions,
  ContextInfo,
  EventPayload,
  GroupPayload,
  IdentifyPayload,
  PagePayload,
  TrackPayload,
  User,
} from './types'
