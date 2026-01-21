/**
 * Utility functions for converting strings between different cases
 */

/**
 * Converts a string from camelCase or PascalCase to snake_case
 * @param str - The string to convert
 * @returns The snake_case version of the string
 */

/**
 * Converts an event name to a valid BigQuery table name
 * @param eventName - The event name to convert
 * @returns A valid table name in snake_case
 */
export function eventNameToTableName(eventName: string): string {
  return eventName
    .toLowerCase() // Convert to lowercase first
    .replace(/[^\da-z]+/g, '_') // Replace any non-alphanumeric characters with single underscore
    .replace(/^_+|_+$/g, '') // Remove leading and trailing underscores
}

export { snakeCase as convertToSnakeCase } from 'lodash-es'
