import { createHmac } from 'node:crypto'

const LEDGER_VERSION = 1
const KEY_PREFIX = 'opentrack:privacy:v1'
const DEFAULT_TIMEOUT_MS = 5000

export class SuppressionLedgerConfigurationError extends Error {}
export class SuppressionIdempotencyConflictError extends Error {}

export interface SuppressionRecord {
  suppressedAt: Date
}

export interface SuppressionLedger {
  suppress(params: { userId: string; idempotencyKey: string; now: Date }): Promise<SuppressionRecord>
  isAnySuppressed(identifiers: string[]): Promise<boolean>
}

interface RedisSuppressionLedgerConfig {
  restUrl: string
  restToken: string
  hashSecret: string
  timeoutMs?: number
  fetcher?: typeof fetch
}

function getRedisResult(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    throw new Error('Suppression datastore returned an invalid response')
  }

  if ('error' in body && typeof body.error === 'string') {
    throw new Error('Suppression datastore command failed')
  }

  if (!('result' in body)) {
    throw new Error('Suppression datastore response is missing a result')
  }

  return body.result
}

function parseSuppressionRecord(value: unknown): SuppressionRecord {
  if (typeof value !== 'string') {
    throw new TypeError('Suppression ledger record is missing')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('Suppression ledger record is invalid')
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('version' in parsed) ||
    parsed.version !== LEDGER_VERSION ||
    !('suppressedAt' in parsed) ||
    typeof parsed.suppressedAt !== 'string'
  ) {
    throw new Error('Suppression ledger record is invalid')
  }

  const suppressedAt = new Date(parsed.suppressedAt)
  if (Number.isNaN(suppressedAt.getTime())) {
    throw new TypeError('Suppression ledger record has an invalid timestamp')
  }

  return { suppressedAt }
}

/** Non-expiring Redis ledger whose keys contain only HMAC-derived identifiers. */
export class RedisSuppressionLedger implements SuppressionLedger {
  private readonly restUrl: string
  private readonly restToken: string
  private readonly hashSecret: string
  private readonly timeoutMs: number
  private readonly fetcher: typeof fetch

  constructor(config: RedisSuppressionLedgerConfig) {
    this.restUrl = config.restUrl.replace(/\/+$/, '')
    this.restToken = config.restToken
    this.hashSecret = config.hashSecret
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetcher = config.fetcher ?? fetch
  }

  private hash(value: string): string {
    return createHmac('sha256', this.hashSecret).update(value).digest('hex')
  }

  private subjectKey(userId: string): string {
    return `${KEY_PREFIX}:subject:${this.hash(`subject:${userId}`)}`
  }

  private idempotencyKey(requestId: string): string {
    return `${KEY_PREFIX}:request:${this.hash(`request:${requestId}`)}`
  }

  private async command(command: Array<string | number>): Promise<unknown> {
    const response = await this.fetcher(this.restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error('Suppression datastore request failed')
    }

    return getRedisResult(await response.json())
  }

  async suppress({
    userId,
    idempotencyKey,
    now,
  }: {
    userId: string
    idempotencyKey: string
    now: Date
  }): Promise<SuppressionRecord> {
    const subjectHash = this.hash(`subject:${userId}`)
    const requestKey = this.idempotencyKey(idempotencyKey)
    const claimed = await this.command(['SET', requestKey, subjectHash, 'NX'])

    if (claimed !== 'OK') {
      const existingSubjectHash = await this.command(['GET', requestKey])
      if (existingSubjectHash !== subjectHash) {
        throw new SuppressionIdempotencyConflictError('Idempotency key belongs to another subject')
      }
    }

    const subjectKey = this.subjectKey(userId)
    const record = JSON.stringify({
      version: LEDGER_VERSION,
      suppressedAt: now.toISOString(),
    })
    await this.command(['SET', subjectKey, record, 'NX'])

    return parseSuppressionRecord(await this.command(['GET', subjectKey]))
  }

  async isAnySuppressed(identifiers: string[]): Promise<boolean> {
    const keys = [...new Set(identifiers.filter(Boolean))].map((identifier) => this.subjectKey(identifier))
    if (keys.length === 0) {
      return false
    }

    const result = await this.command(['MGET', ...keys])
    if (!Array.isArray(result) || result.length !== keys.length) {
      throw new Error('Suppression datastore returned an invalid lookup response')
    }

    return result.some((value) => value !== null)
  }
}

class UnavailableSuppressionLedger implements SuppressionLedger {
  constructor(private readonly missingVariables: string[]) {}

  private unavailable(): never {
    throw new SuppressionLedgerConfigurationError(
      `Suppression ledger is missing configuration: ${this.missingVariables.join(', ')}`
    )
  }

  suppress(): Promise<SuppressionRecord> {
    return this.unavailable()
  }

  isAnySuppressed(): Promise<boolean> {
    return this.unavailable()
  }
}

/** Creates a fail-closed ledger without performing network work at module load. */
export function createSuppressionLedgerFromEnvironment(): SuppressionLedger {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN
  const hashSecret = process.env.OPENTRACK_SUPPRESSION_HASH_SECRET
  const missingVariables = [
    !restUrl ? 'UPSTASH_REDIS_REST_URL' : null,
    !restToken ? 'UPSTASH_REDIS_REST_TOKEN' : null,
    !hashSecret ? 'OPENTRACK_SUPPRESSION_HASH_SECRET' : null,
  ].filter((name): name is string => name !== null)

  if (!restUrl || !restToken || !hashSecret) {
    return new UnavailableSuppressionLedger(missingVariables)
  }

  return new RedisSuppressionLedger({ restUrl, restToken, hashSecret })
}
