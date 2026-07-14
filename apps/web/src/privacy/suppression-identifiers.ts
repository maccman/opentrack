import type { IntegrationPayload } from '@app/core'

/** Returns every canonical identity edge that could re-associate a suppressed subject. */
export function getSuppressionIdentifiers(payload: IntegrationPayload): string[] {
  const identifiers: string[] = []

  if (payload.userId) {
    identifiers.push(payload.userId)
  }
  if (payload.type === 'alias') {
    identifiers.push(payload.previousId)
  } else if (payload.anonymousId) {
    identifiers.push(payload.anonymousId)
  }

  return identifiers
}
