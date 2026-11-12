/**
 * Devuelve una copia del objeto sin las claves cuyo valor sea `undefined`.
 * Útil para construir `data` de Prisma a partir de DTOs parciales.
 */
export function defined<T extends Record<string, unknown>>(
  source: T,
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}
