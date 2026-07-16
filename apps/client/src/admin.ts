/**
 * Server-only admin client for OpenTrack privacy regulations.
 *
 * Wraps `POST /internal/v1/regulations` (modeled on Segment's Deletion and
 * Suppression API) with typed statuses and input validation. Authentication
 * uses the deployment's server-only `OPENTRACK_SECRET`, so this module must
 * never be imported into browser code: import it from
 * `opentrack-analytics/admin` in Node.js (>= 18) only.
 */

export const MAX_SUBJECT_IDS = 100
export const MAX_SUBJECT_ID_LENGTH = 255

export type RegulationStatus = 'FINISHED' | 'RUNNING' | 'PARTIAL_SUCCESS' | 'FAILED' | 'NOT_SUPPORTED'
export type DestinationRegulationStatus = 'FINISHED' | 'RUNNING' | 'FAILED' | 'NOT_SUPPORTED'

export interface DestinationRegulationReport {
  name: string
  status: DestinationRegulationStatus
}

export interface RegulationResult {
  regulationType: 'DELETE_ONLY'
  subjectType: 'USER_ID'
  /**
   * Overall regulation outcome. `FINISHED` means every deletion-capable
   * destination deleted the subjects' current data. `RUNNING` means the same
   * request should be retried after `retryAfterSeconds` (deletion is
   * idempotent). `FAILED` and `PARTIAL_SUCCESS` mean at least one destination
   * failed and the request should be retried. `NOT_SUPPORTED` means no
   * configured destination can delete users.
   */
  status: RegulationStatus
  destinations: DestinationRegulationReport[]
  /** Present when `status` is `RUNNING`: seconds to wait before retrying. */
  retryAfterSeconds?: number
}

export interface CreateRegulationOptions {
  /** Base URL of the OpenTrack deployment, e.g. `https://analytics.example.com`. */
  host: string
  /** The deployment's server-only `OPENTRACK_SECRET`. Never expose it to browsers. */
  secret: string
  /** 1-100 user ids, each 1-255 characters — the same ids sent to the ingestion API. */
  subjectIds: string[]
  /** Overridable fetch implementation (defaults to the Node.js global). */
  fetch?: typeof fetch
}

/** A rejected regulation request: bad input (400/415), bad credential (401), or a misconfigured deployment (503). */
export class RegulationRequestError extends Error {
  constructor(
    /** HTTP status returned by the deployment. */
    public readonly status: number,
    /** Machine-readable error type from the deployment (e.g. `authentication_error`). */
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'RegulationRequestError'
  }
}

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/u

function validateSubjectIds(subjectIds: unknown): asserts subjectIds is string[] {
  if (!Array.isArray(subjectIds) || subjectIds.length === 0 || subjectIds.length > MAX_SUBJECT_IDS) {
    throw new TypeError(`subjectIds must contain between 1 and ${MAX_SUBJECT_IDS} ids`)
  }
  // Identifier values are deliberately kept out of error messages.
  for (const subjectId of subjectIds) {
    if (
      typeof subjectId !== 'string' ||
      subjectId.length === 0 ||
      subjectId.length > MAX_SUBJECT_ID_LENGTH ||
      subjectId.trim() !== subjectId ||
      CONTROL_CHARACTERS.test(subjectId)
    ) {
      throw new TypeError(
        `every subject id must be a 1-${MAX_SUBJECT_ID_LENGTH} character string without surrounding whitespace or control characters`
      )
    }
  }
}

function isDestinationReport(value: unknown): value is DestinationRegulationReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DestinationRegulationReport).name === 'string' &&
    typeof (value as DestinationRegulationReport).status === 'string'
  )
}

function parseRegulationBody(body: unknown): Pick<RegulationResult, 'status' | 'destinations'> {
  const candidate = body as { status?: unknown; destinations?: unknown }
  if (
    !body ||
    typeof body !== 'object' ||
    typeof candidate.status !== 'string' ||
    !Array.isArray(candidate.destinations) ||
    !candidate.destinations.every((destination) => isDestinationReport(destination))
  ) {
    throw new RegulationRequestError(0, 'invalid_response', 'OpenTrack returned an unrecognized regulation response')
  }
  return {
    status: candidate.status as RegulationStatus,
    destinations: candidate.destinations,
  }
}

/**
 * Creates and synchronously executes a `DELETE_ONLY` regulation.
 *
 * Returns the regulation result for every well-formed outcome, including
 * `FAILED`, `PARTIAL_SUCCESS`, and `NOT_SUPPORTED` — branch on
 * {@link RegulationResult.status}. Throws {@link RegulationRequestError} when
 * the request itself is rejected (invalid body, wrong secret, misconfigured
 * deployment) and `TypeError` for locally invalid options.
 */
export async function createRegulation(options: CreateRegulationOptions): Promise<RegulationResult> {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    throw new TypeError(
      'opentrack-analytics/admin is server-only: calling it from a browser would expose OPENTRACK_SECRET'
    )
  }

  const { host, secret, subjectIds } = options
  if (typeof host !== 'string' || host.length === 0) {
    throw new TypeError('host must be the base URL of an OpenTrack deployment')
  }
  if (typeof secret !== 'string' || secret.length < 32 || /\s/u.test(secret)) {
    throw new TypeError('secret must be the OPENTRACK_SECRET: at least 32 characters with no whitespace')
  }
  validateSubjectIds(subjectIds)

  const doFetch = options.fetch ?? globalThis.fetch
  const url = new URL('/internal/v1/regulations', host)

  const response = await doFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      regulationType: 'DELETE_ONLY',
      subjectType: 'USER_ID',
      subjectIds,
    }),
  })

  const body: unknown = await response.json().catch(() => null)

  // These statuses carry a regulation body the caller should branch on:
  // 200 FINISHED, 202 RUNNING, 501 NOT_SUPPORTED, 502 FAILED/PARTIAL_SUCCESS.
  if ([200, 202, 501, 502].includes(response.status)) {
    const { status, destinations } = parseRegulationBody(body)
    const result: RegulationResult = {
      regulationType: 'DELETE_ONLY',
      subjectType: 'USER_ID',
      status,
      destinations,
    }
    if (response.status === 202) {
      const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10)
      result.retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1800
    }
    return result
  }

  const errorBody = (body ?? {}) as { error?: unknown; type?: unknown }
  throw new RegulationRequestError(
    response.status,
    typeof errorBody.type === 'string' ? errorBody.type : 'unknown_error',
    typeof errorBody.error === 'string' ? errorBody.error : 'OpenTrack rejected the regulation request'
  )
}
