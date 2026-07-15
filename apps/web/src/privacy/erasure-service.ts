import type { BigQueryErasureResult } from '@integrations/bigquery'

import type { SuppressionLedger } from './suppression-ledger'

export const BIGQUERY_STREAMING_GRACE_MS = 35 * 60 * 1000

export interface BigQueryEraser {
  eraseUser(userId: string): Promise<BigQueryErasureResult>
}

export interface CustomerIoEraser {
  suppressUser(userId: string): Promise<void>
}

export interface PrivacyErasureServiceConfig {
  ledger: SuppressionLedger
  bigQuery?: BigQueryEraser
  customerIo?: CustomerIoEraser
  webhookConfigured: boolean
  now?: () => Date
}

export type PrivacyErasureResult =
  | {
      status: 'complete'
      suppressed: true
      destinations: {
        bigQuery: 'erased' | 'not_configured'
        customerIo: 'suppressed' | 'not_configured'
      }
    }
  | {
      status: 'pending'
      suppressed: true
      retryAfterSeconds: number
      destinations: {
        bigQuery: 'pending'
        customerIo: 'suppressed' | 'not_configured'
      }
    }
  | {
      status: 'blocked'
      suppressed: true
      reason: 'webhook_destination_unsupported'
      destinations: {
        bigQuery: 'erased' | 'pending' | 'not_configured'
        customerIo: 'suppressed' | 'not_configured'
        webhook: 'unsupported'
      }
    }

/** Coordinates durable suppression before every destination-specific erasure. */
export class PrivacyErasureService {
  private readonly ledger: SuppressionLedger
  private readonly bigQuery?: BigQueryEraser
  private readonly customerIo?: CustomerIoEraser
  private readonly webhookConfigured: boolean
  private readonly now: () => Date

  constructor(config: PrivacyErasureServiceConfig) {
    this.ledger = config.ledger
    this.bigQuery = config.bigQuery
    this.customerIo = config.customerIo
    this.webhookConfigured = config.webhookConfigured
    this.now = config.now ?? (() => new Date())
  }

  async erase(params: { userId: string; idempotencyKey: string }): Promise<PrivacyErasureResult> {
    const now = this.now()
    const suppression = await this.ledger.suppress({ ...params, now })

    let customerIoStatus: 'suppressed' | 'not_configured' = 'not_configured'
    if (this.customerIo) {
      await this.customerIo.suppressUser(params.userId)
      customerIoStatus = 'suppressed'
    }

    let bigQueryStatus: 'erased' | 'pending' | 'not_configured' = 'not_configured'
    let retryAfterSeconds: number | undefined
    if (this.bigQuery) {
      const erasure = await this.bigQuery.eraseUser(params.userId)
      const graceRemainingMs = suppression.suppressedAt.getTime() + BIGQUERY_STREAMING_GRACE_MS - now.getTime()

      if (graceRemainingMs > 0 || erasure.status === 'pending') {
        bigQueryStatus = 'pending'
        retryAfterSeconds =
          graceRemainingMs > 0
            ? Math.max(1, Math.ceil(graceRemainingMs / 1000))
            : Math.ceil(BIGQUERY_STREAMING_GRACE_MS / 1000)
      } else {
        bigQueryStatus = 'erased'
      }
    }

    if (this.webhookConfigured) {
      return {
        status: 'blocked',
        suppressed: true,
        reason: 'webhook_destination_unsupported',
        destinations: {
          bigQuery: bigQueryStatus,
          customerIo: customerIoStatus,
          webhook: 'unsupported',
        },
      }
    }

    if (bigQueryStatus === 'pending') {
      return {
        status: 'pending',
        suppressed: true,
        retryAfterSeconds: retryAfterSeconds ?? Math.ceil(BIGQUERY_STREAMING_GRACE_MS / 1000),
        destinations: {
          bigQuery: 'pending',
          customerIo: customerIoStatus,
        },
      }
    }

    return {
      status: 'complete',
      suppressed: true,
      destinations: {
        bigQuery: bigQueryStatus,
        customerIo: customerIoStatus,
      },
    }
  }
}
