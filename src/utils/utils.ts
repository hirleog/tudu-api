export function normalizeStrings<T extends object>(
  obj: T,
  ignoreKeys: string[] = [],
): T {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'string' && !ignoreKeys.includes(key)) {
        return [key, value.toLowerCase()];
      }
      return [key, value];
    }),
  ) as T;
}
