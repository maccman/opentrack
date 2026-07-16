import { afterEach, describe, expect, it, vi } from 'vitest'

import { RegulationService } from '../regulation-service'

const subjectIds = ['user_1', 'user_2']

function deleter(status: 'FINISHED' | 'RUNNING') {
  return { deleteUsers: vi.fn().mockResolvedValue({ status }) }
}

function failingDeleter() {
  return { deleteUsers: vi.fn().mockRejectedValue(new Error('secret provider detail about user_1')) }
}

describe('RegulationService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finishes when every supporting destination finishes', async () => {
    const bigquery = deleter('FINISHED')
    const customerio = deleter('FINISHED')
    const service = new RegulationService(
      [
        { name: 'bigquery', deleter: bigquery },
        { name: 'customerio', deleter: customerio },
      ],
      []
    )

    const result = await service.deleteUsers(subjectIds)

    expect(result).toEqual({
      status: 'FINISHED',
      destinations: [
        { name: 'bigquery', status: 'FINISHED' },
        { name: 'customerio', status: 'FINISHED' },
      ],
    })
    expect(bigquery.deleteUsers).toHaveBeenCalledWith(subjectIds)
    expect(customerio.deleteUsers).toHaveBeenCalledWith(subjectIds)
  })

  it('reports RUNNING while any destination is still settling', async () => {
    const service = new RegulationService(
      [
        { name: 'bigquery', deleter: deleter('RUNNING') },
        { name: 'customerio', deleter: deleter('FINISHED') },
      ],
      []
    )

    const result = await service.deleteUsers(subjectIds)

    expect(result.status).toBe('RUNNING')
    expect(result.destinations).toContainEqual({ name: 'bigquery', status: 'RUNNING' })
  })

  it('reports unsupported destinations without blocking supporting ones', async () => {
    const service = new RegulationService([{ name: 'bigquery', deleter: deleter('FINISHED') }], ['webhook'])

    const result = await service.deleteUsers(subjectIds)

    expect(result.status).toBe('FINISHED')
    expect(result.destinations).toContainEqual({ name: 'webhook', status: 'NOT_SUPPORTED' })
  })

  it('reports PARTIAL_SUCCESS when some destinations fail, logging no identifiers', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const service = new RegulationService(
      [
        { name: 'bigquery', deleter: failingDeleter() },
        { name: 'customerio', deleter: deleter('FINISHED') },
      ],
      []
    )

    const result = await service.deleteUsers(subjectIds)

    expect(result.status).toBe('PARTIAL_SUCCESS')
    expect(result.destinations).toContainEqual({ name: 'bigquery', status: 'FAILED' })
    expect(consoleError).toHaveBeenCalledWith('Privacy regulation destination failed', {
      destination: 'bigquery',
      errorType: 'Error',
    })
    const logged = JSON.stringify(consoleError.mock.calls)
    expect(logged).not.toContain('user_1')
  })

  it('reports FAILED when every supporting destination fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const service = new RegulationService(
      [
        { name: 'bigquery', deleter: failingDeleter() },
        { name: 'customerio', deleter: failingDeleter() },
      ],
      []
    )

    const result = await service.deleteUsers(subjectIds)
    expect(result.status).toBe('FAILED')
  })

  it('reports NOT_SUPPORTED when no destination can delete users', async () => {
    const service = new RegulationService([], ['webhook'])

    const result = await service.deleteUsers(subjectIds)

    expect(result).toEqual({
      status: 'NOT_SUPPORTED',
      destinations: [{ name: 'webhook', status: 'NOT_SUPPORTED' }],
    })
  })
})
