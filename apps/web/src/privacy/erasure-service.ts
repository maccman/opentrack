import type { BigQueryErasureResult } from '@integrations/bigquery'

export const BIGQUERY_ERASURE_RETRY_AFTER_SECONDS = 35 * 60

export interface BigQueryEraser {
  eraseUser(userId: string): Promise<BigQueryErasureResult>
}

export interface CustomerIoEraser {
  eraseUser(userId: string): Promise<void>
}

export type PrivacyErasureDestination = 'bigQuery' | 'customerIo'

/** Reports destination failures without retaining provider errors or subject identifiers. */
export class PrivacyErasureError extends Error {
  constructor(public readonly failedDestinations: PrivacyErasureDestination[]) {
    super('Privacy erasure failed')
    this.name = 'PrivacyErasureError'
  }
}

export type PrivacyErasureResult =
  | {
      status: 'complete'
      destinations: {
        bigQuery: 'erased'
        customerIo: 'erased'
      }
    }
  | {
      status: 'pending'
      retryAfterSeconds: number
      destinations: {
        bigQuery: 'pending'
        customerIo: 'erased'
      }
    }

/** Deletes the subject data currently held by each configured destination. */
export class PrivacyErasureService {
  constructor(
    private readonly bigQuery: BigQueryEraser,
    private readonly customerIo: CustomerIoEraser
  ) {}

  async erase(userId: string): Promise<PrivacyErasureResult> {
    const [bigQueryResult, customerIoResult] = await Promise.allSettled([
      this.bigQuery.eraseUser(userId),
      this.customerIo.eraseUser(userId),
    ])

    if (bigQueryResult.status === 'rejected' || customerIoResult.status === 'rejected') {
      const failedDestinations: PrivacyErasureDestination[] = []
      if (bigQueryResult.status === 'rejected') {
        failedDestinations.push('bigQuery')
      }
      if (customerIoResult.status === 'rejected') {
        failedDestinations.push('customerIo')
      }
      throw new PrivacyErasureError(failedDestinations)
    }

    if (bigQueryResult.value.status === 'pending') {
      return {
        status: 'pending',
        retryAfterSeconds: BIGQUERY_ERASURE_RETRY_AFTER_SECONDS,
        destinations: { bigQuery: 'pending', customerIo: 'erased' },
      }
    }

    return {
      status: 'complete',
      destinations: { bigQuery: 'erased', customerIo: 'erased' },
    }
  }
}
