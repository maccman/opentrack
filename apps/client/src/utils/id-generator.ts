// ID Generation Utilities

/**
 * Generates cryptographically secure random values
 */
function getRandomValues(): () => number {
  // Use crypto.getRandomValues if available (secure)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(1)
    return () => {
      crypto.getRandomValues(array)
      return array[0] / 256 // Convert to 0-1 range
    }
  }

  // Fallback to Math.random (less secure but compatible)
  return () => Math.random()
}

/**
 * Generates a UUID v4 string using cryptographically secure random numbers when available
 */
export function generateId(): string {
  const getRandom = getRandomValues()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.trunc(getRandom() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Generates a message ID with analytics prefix
 */
export function generateMessageId(): string {
  return `ajs-msg-${generateId()}`
}
