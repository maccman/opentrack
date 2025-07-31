import { convertToSnakeCase } from './case-converter'

/**
 * Utility functions for flattening nested objects according to Segment BigQuery conventions
 */

/**
 * Flattens a nested object into a flat object with snake_case keys
 * Arrays are JSON stringified, objects are recursively flattened
 * @param obj - The object to flatten
 * @param prefix - Optional prefix for keys
 * @returns Flattened object with snake_case keys
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${convertToSnakeCase(key)}` : convertToSnakeCase(key)

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(flattened, flattenObject(value, newKey))
    } else if (Array.isArray(value)) {
      flattened[newKey] = JSON.stringify(value)
    } else {
      flattened[newKey] = value
    }
  }

  return flattened
}
