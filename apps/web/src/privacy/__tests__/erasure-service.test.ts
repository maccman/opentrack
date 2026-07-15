import { describe, expect, it, vi } from 'vitest'

import { BIGQUERY_ERASURE_RETRY_AFTER_SECONDS, PrivacyErasureService } from '../erasure-service'

const userId = 'b9a54fe6-c995-4f14-9d85-0769b11dfe57'

describe('PrivacyErasureService', () => {
  it('deletes the data currently held by both destinations', async () => {
    const bigQuery = {
      eraseUser: vi.fn().mockResolvedValue({ status: 'erased', remainingRows: 0, pendingTableCount: 0 }),
    }
    const customerIo = { eraseUser: vi.fn().mockResolvedValue(undefined) }
    const service = new PrivacyErasureService(bigQuery, customerIo)

    await expect(service.erase(userId)).resolves.toEqual({
      status: 'complete',
      destinations: { bigQuery: 'erased', customerIo: 'erased' },
    })
    expect(bigQuery.eraseUser).toHaveBeenCalledWith(userId)
    expect(customerIo.eraseUser).toHaveBeenCalledWith(userId)
  })

  it('asks the caller to retry while BigQuery still has streamed rows', async () => {
    const service = new PrivacyErasureService(
      {
        eraseUser: vi.fn().mockResolvedValue({ status: 'pending', remainingRows: 1, pendingTableCount: 1 }),
      },
      { eraseUser: vi.fn().mockResolvedValue(undefined) }
    )

    await expect(service.erase(userId)).resolves.toEqual({
      status: 'pending',
      retryAfterSeconds: BIGQUERY_ERASURE_RETRY_AFTER_SECONDS,
      destinations: { bigQuery: 'pending', customerIo: 'erased' },
    })
  })

  it('does not remember previous erasures', async () => {
    const bigQuery = {
      eraseUser: vi.fn().mockResolvedValue({ status: 'erased', remainingRows: 0, pendingTableCount: 0 }),
    }
    const customerIo = { eraseUser: vi.fn().mockResolvedValue(undefined) }
    const service = new PrivacyErasureService(bigQuery, customerIo)

    await service.erase(userId)
    await service.erase(userId)

    expect(bigQuery.eraseUser).toHaveBeenCalledTimes(2)
    expect(customerIo.eraseUser).toHaveBeenCalledTimes(2)
  })

  it('fails the request when either destination fails', async () => {
    const service = new PrivacyErasureService(
      { eraseUser: vi.fn().mockRejectedValue(new Error('BigQuery unavailable')) },
      { eraseUser: vi.fn().mockResolvedValue(undefined) }
    )

    await expect(service.erase(userId)).rejects.toThrow('BigQuery unavailable')
  })
})
