import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createSuppressionLedgerFromEnvironment,
  RedisSuppressionLedger,
  SuppressionIdempotencyConflictError,
  SuppressionLedgerConfigurationError,
} from '../suppression-ledger'

function createRedisFetcher() {
  const values = new Map<string, string>()
  const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
    if (typeof init?.body !== 'string') {
      throw new TypeError('expected a serialized Redis command')
    }
    const command = JSON.parse(init.body) as string[]
    let result: unknown

    switch (command[0]) {
      case 'SET':
        if (command[3] === 'NX' && values.has(command[1])) {
          result = null
        } else {
          values.set(command[1], command[2])
          result = 'OK'
        }
        break
      case 'GET':
        result = values.get(command[1]) ?? null
        break
      case 'MGET':
        result = command.slice(1).map((key) => values.get(key) ?? null)
        break
      default:
        throw new Error('unexpected Redis command')
    }

    return Promise.resolve(new Response(JSON.stringify({ result }), { status: 200 }))
  })

  return { fetcher, values }
}

describe('RedisSuppressionLedger', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('stores permanent HMAC-keyed suppression and detects it', async () => {
    const { fetcher, values } = createRedisFetcher()
    const ledger = new RedisSuppressionLedger({
      restUrl: 'https://redis.example',
      restToken: 'redis-token',
      hashSecret: 'hash-secret',
      fetcher: fetcher as typeof fetch,
    })

    const record = await ledger.suppress({
      userId: 'sensitive-user-id',
      idempotencyKey: 'f0509ab9-ecbe-4cab-b04a-af9693434589',
      now: new Date('2026-07-14T12:00:00.000Z'),
    })

    expect(record.suppressedAt.toISOString()).toBe('2026-07-14T12:00:00.000Z')
    await expect(ledger.isAnySuppressed(['other-id', 'sensitive-user-id'])).resolves.toBe(true)
    expect([...values.keys()].every((key) => !key.includes('sensitive-user-id'))).toBe(true)
    expect(
      fetcher.mock.calls
        .map(([, init]) => (typeof init?.body === 'string' ? init.body : ''))
        .every((body) => !body.includes('sensitive-user-id') && !body.includes('EX') && !body.includes('PX'))
    ).toBe(true)
  })

  it('preserves the original suppression time across idempotent retries', async () => {
    const { fetcher } = createRedisFetcher()
    const ledger = new RedisSuppressionLedger({
      restUrl: 'https://redis.example',
      restToken: 'redis-token',
      hashSecret: 'hash-secret',
      fetcher: fetcher as typeof fetch,
    })
    const request = {
      userId: 'user-123',
      idempotencyKey: 'f0509ab9-ecbe-4cab-b04a-af9693434589',
    }

    await ledger.suppress({ ...request, now: new Date('2026-07-14T12:00:00.000Z') })
    const retry = await ledger.suppress({ ...request, now: new Date('2026-07-14T13:00:00.000Z') })

    expect(retry.suppressedAt.toISOString()).toBe('2026-07-14T12:00:00.000Z')
  })

  it('rejects reuse of an idempotency key for a different subject', async () => {
    const { fetcher } = createRedisFetcher()
    const ledger = new RedisSuppressionLedger({
      restUrl: 'https://redis.example',
      restToken: 'redis-token',
      hashSecret: 'hash-secret',
      fetcher: fetcher as typeof fetch,
    })
    const idempotencyKey = 'f0509ab9-ecbe-4cab-b04a-af9693434589'
    await ledger.suppress({ userId: 'user-a', idempotencyKey, now: new Date() })

    await expect(ledger.suppress({ userId: 'user-b', idempotencyKey, now: new Date() })).rejects.toBeInstanceOf(
      SuppressionIdempotencyConflictError
    )
  })

  it('fails closed when the datastore is not configured or unavailable', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('OPENTRACK_SUPPRESSION_HASH_SECRET', '')
    const unavailable = createSuppressionLedgerFromEnvironment()

    await expect(Promise.resolve().then(() => unavailable.isAnySuppressed(['user-123']))).rejects.toBeInstanceOf(
      SuppressionLedgerConfigurationError
    )

    const ledger = new RedisSuppressionLedger({
      restUrl: 'https://redis.example',
      restToken: 'redis-token',
      hashSecret: 'hash-secret',
      fetcher: vi.fn().mockRejectedValue(new Error('network down')) as typeof fetch,
    })
    await expect(ledger.isAnySuppressed(['user-123'])).rejects.toThrow('network down')
  })
})
