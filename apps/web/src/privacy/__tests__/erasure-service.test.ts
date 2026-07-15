import { describe, expect, it, vi } from 'vitest'

import { BIGQUERY_ERASURE_RETRY_AFTER_SECONDS, PrivacyErasureError, PrivacyErasureService } from '../erasure-service'

const userId = 'b9a54fe6-c995-4f14-9d85-0769b11dfe57'

describe('PrivacyErasureService', () => {
  it('deletes the data currently held by both destinations', async () => {
    const bigQuery = {
      eraseUser: vi.fn().mockResolvedValue({ status: 'erased' }),
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
        eraseUser: vi.fn().mockResolvedValue({ status: 'pending' }),
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
      eraseUser: vi.fn().mockResolvedValue({ status: 'erased' }),
    }
    const customerIo = { eraseUser: vi.fn().mockResolvedValue(undefined) }
    const service = new PrivacyErasureService(bigQuery, customerIo)

    await service.erase(userId)
    await service.erase(userId)

    expect(bigQuery.eraseUser).toHaveBeenCalledTimes(2)
    expect(customerIo.eraseUser).toHaveBeenCalledTimes(2)
  })

  it('waits for Customer.io and reports only the failed destination when BigQuery fails', async () => {
    const customerIo = { eraseUser: vi.fn().mockResolvedValue(undefined) }
    const service = new PrivacyErasureService(
      { eraseUser: vi.fn().mockRejectedValue(new Error('BigQuery unavailable')) },
      customerIo
    )

    await expect(service.erase(userId)).rejects.toEqual(new PrivacyErasureError(['bigQuery']))
    expect(customerIo.eraseUser).toHaveBeenCalledWith(userId)
  })

  it('waits for BigQuery and reports only the failed destination when Customer.io fails', async () => {
    const bigQuery = {
      eraseUser: vi.fn().mockResolvedValue({ status: 'erased' }),
    }
    const service = new PrivacyErasureService(bigQuery, {
      eraseUser: vi.fn().mockRejectedValue(new Error('Customer.io unavailable for user')),
    })

    await expect(service.erase(userId)).rejects.toEqual(new PrivacyErasureError(['customerIo']))
    expect(bigQuery.eraseUser).toHaveBeenCalledWith(userId)
  })

  it('reports all failed destinations without exposing provider error messages', async () => {
    const service = new PrivacyErasureService(
      { eraseUser: vi.fn().mockRejectedValue(new Error('BigQuery unavailable')) },
      { eraseUser: vi.fn().mockRejectedValue(new Error('Customer.io unavailable for user')) }
    )

    const error = await service.erase(userId).catch((caught: unknown) => caught)

    expect(error).toEqual(new PrivacyErasureError(['bigQuery', 'customerIo']))
    expect(error).not.toHaveProperty('message', expect.stringContaining('unavailable'))
  })
})
