/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

export function isError(value: unknown): value is Error {
  // @ts-expect-error: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError
  return Error.isError?.(value) ?? value instanceof Error
}
