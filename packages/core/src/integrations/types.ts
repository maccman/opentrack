import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import type { Logger } from 'pino'

export type IntegrationPayload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

export interface LoggerConfig {
  enabled: boolean
  logger?: Logger
}

export interface IntegrationResult {
  integrationName: string
  success: boolean
  error?: Error
  duration: number
}
