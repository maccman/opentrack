/**
 * What is logged about a failed integration call
 */
export interface IntegrationErrorSummary {
  name?: string
  message: string
  code?: string | number
  statusCode?: number
  /** Per-item failure reasons and locations (e.g. a BigQuery column), without values */
  details?: Array<{ reason: string; location?: string }>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Collects `reason`/`location` pairs from an `errors` array, one level deep.
 *
 * BigQuery reports insert failures as `[{ row, errors: [{ reason, location, message }] }]`
 * and API failures as `[{ reason, location, message }]`. Messages and rows are
 * skipped because they can echo the rejected values.
 */
function collectDetails(errors: unknown): Array<{ reason: string; location?: string }> {
  if (!Array.isArray(errors)) {
    return []
  }

  const details = new Map<string, { reason: string; location?: string }>()
  const entries = errors.flatMap((entry: unknown) => {
    const record = asRecord(entry)
    return Array.isArray(record?.errors) ? [record, ...(record.errors as unknown[])] : [record]
  })

  for (const entry of entries) {
    const record = asRecord(entry)
    if (typeof record?.reason !== 'string') {
      continue
    }
    const location = typeof record.location === 'string' ? record.location : undefined
    details.set(`${record.reason}:${location ?? ''}`, { reason: record.reason, location })
  }

  return [...details.values()]
}

/**
 * Summarizes an integration error for logging.
 *
 * The raw error is never logged: destination errors can carry the rejected
 * rows or request payloads (user ids, traits), and log pipelines are rarely
 * covered by data deletion. Errors may also be plain objects, which some
 * integrations throw after mapping SDK errors.
 */
export function describeIntegrationError(error: unknown): IntegrationErrorSummary {
  const record = asRecord(error)
  if (!record) {
    return { message: String(error) }
  }

  const summary: IntegrationErrorSummary = {
    message: typeof record.message === 'string' ? record.message : 'Unknown error',
  }
  if (typeof record.name === 'string') {
    summary.name = record.name
  }
  if (typeof record.code === 'string' || typeof record.code === 'number') {
    summary.code = record.code
  }
  if (typeof record.statusCode === 'number') {
    summary.statusCode = record.statusCode
  }

  const details = collectDetails(record.errors)
  if (details.length > 0) {
    summary.details = details
  }

  return summary
}
