/**
 * Firestore rejects `undefined` field values ("Unsupported field value: undefined") and the error is easy
 * to swallow in a catch, silently losing the write. Strip them before writing instead of relying on the
 * client-wide `ignoreUndefinedProperties` flag.
 */
export function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(omitUndefined) as unknown as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, omitUndefined(v)])
    ) as T;
  }
  return value;
}
