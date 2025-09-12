export function normalizeStrings<T extends object>(
  obj: T,
  ignoreKeys: string[] = [],
): T {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      // Verifica se a chave está na lista de ignoradas
      if (ignoreKeys.includes(key)) {
        return [key, value]; // Retorna o valor original sem modificação
      }

      if (typeof value === 'string') {
        return [key, value.toLowerCase()];
      }
      return [key, value];
    }),
  ) as T;
}
