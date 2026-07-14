import { describe, expect, it, vi } from 'vitest'

import { BIGQUERY_STREAMING_GRACE_MS, PrivacyErasureService } from '../erasure-service'
import type { SuppressionLedger } from '../suppression-ledger'

const request = {
  userId: 'b9a54fe6-c995-4f14-9d85-0769b11dfe57',
  idempotencyKey: 'f0509ab9-ecbe-4cab-b04a-af9693434589',
}

function createLedger(suppressedAt: Date): SuppressionLedger {
  return {
    suppress: vi.fn().mockResolvedValue({ suppressedAt }),
    isAnySuppressed: vi.fn().mockResolvedValue(true),
  }
}

describe('PrivacyErasureService', () => {
  it('completes immediately when no external destinations are configured', async () => {
    const service = new PrivacyErasureService({
      ledger: createLedger(new Date('2026-07-14T12:00:00.000Z')),
      webhookConfigured: false,
    })

    await expect(service.erase(request)).resolves.toEqual({
      status: 'complete',
      suppressed: true,
      destinations: { bigQuery: 'not_configured', customerIo: 'not_configured' },
    })
  })

  it('waits out insertAll and re-suppresses Customer.io on the mandatory retry', async () => {
    const suppressedAt = new Date('2026-07-14T12:00:00.000Z')
    let now = new Date(suppressedAt)
    const customerIo = { suppressUser: vi.fn().mockResolvedValue(undefined) }
    const bigQuery = {
      eraseUser: vi.fn().mockResolvedValue({ status: 'erased', remainingRows: 0, pendingTableCount: 0 }),
    }
    const service = new PrivacyErasureService({
      ledger: createLedger(suppressedAt),
      customerIo,
      bigQuery,
      webhookConfigured: false,
      now: () => now,
    })

    await expect(service.erase(request)).resolves.toMatchObject({
      status: 'pending',
      retryAfterSeconds: BIGQUERY_STREAMING_GRACE_MS / 1000,
      destinations: { bigQuery: 'pending', customerIo: 'suppressed' },
    })

    // An already-in-flight analytics request could have recreated the profile after the first suppress.
    now = new Date(suppressedAt.getTime() + BIGQUERY_STREAMING_GRACE_MS)
    await expect(service.erase(request)).resolves.toEqual({
      status: 'complete',
      suppressed: true,
      destinations: { bigQuery: 'erased', customerIo: 'suppressed' },
    })
    expect(customerIo.suppressUser).toHaveBeenCalledTimes(2)
    expect(bigQuery.eraseUser).toHaveBeenCalledTimes(2)
  })

  it('remains pending when BigQuery verification still finds streamed rows after the grace period', async () => {
    const suppressedAt = new Date('2026-07-14T12:00:00.000Z')
    const service = new PrivacyErasureService({
      ledger: createLedger(suppressedAt),
      bigQuery: {
        eraseUser: vi.fn().mockResolvedValue({ status: 'pending', remainingRows: 1, pendingTableCount: 1 }),
      },
      webhookConfigured: false,
      now: () => new Date(suppressedAt.getTime() + BIGQUERY_STREAMING_GRACE_MS),
    })

    await expect(service.erase(request)).resolves.toMatchObject({
      status: 'pending',
      retryAfterSeconds: BIGQUERY_STREAMING_GRACE_MS / 1000,
    })
  })

  it('blocks completion whenever a generic webhook destination is configured', async () => {
    const service = new PrivacyErasureService({
      ledger: createLedger(new Date('2026-07-14T12:00:00.000Z')),
      webhookConfigured: true,
    })

    await expect(service.erase(request)).resolves.toMatchObject({
      status: 'blocked',
      reason: 'webhook_destination_unsupported',
      destinations: { webhook: 'unsupported' },
    })
  })

  it('persists suppression before invoking destinations', async () => {
    const order: string[] = []
    const suppress = vi.fn(() => {
      order.push('ledger')
      return Promise.resolve({ suppressedAt: new Date('2026-07-14T12:00:00.000Z') })
    })
    const ledger: SuppressionLedger = {
      suppress,
      isAnySuppressed: vi.fn().mockResolvedValue(true),
    }
    const service = new PrivacyErasureService({
      ledger,
      customerIo: {
        suppressUser: vi.fn().mockImplementation(() => {
          order.push('customerIo')
          return Promise.resolve()
        }),
      },
      webhookConfigured: false,
    })

    await service.erase(request)

    expect(order).toEqual(['ledger', 'customerIo'])
  })
})
