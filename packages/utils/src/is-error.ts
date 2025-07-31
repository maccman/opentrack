export function isError(value: unknown): value is Error {
  // @ts-expect-error: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return Error.isError?.(value) ?? value instanceof Error
}
