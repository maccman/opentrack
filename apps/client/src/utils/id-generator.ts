// ID Generation Utilities

/**
 * Generates a UUID v4 string
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.trunc(Math.random() * 16)
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
