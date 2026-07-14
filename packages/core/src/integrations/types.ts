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
  /** The event matched a durable privacy suppression before fan-out. */
  suppressed?: boolean
  /** The suppression store could not be checked, so delivery failed closed. */
  blocked?: boolean
}

/** Privacy boundary evaluated once before any destination receives an event. */
export interface SuppressionGuard {
  isSuppressed(payload: IntegrationPayload): Promise<boolean>
}
