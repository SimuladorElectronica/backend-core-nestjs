import { generateShareSlug } from '../../common/utils/share-slug.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { conflict } from '../../common/errors.js';

/** intentos ante la colisión del código único del aula */
const MAX_ATTEMPTS = 5;

/**
 * Genera un `code` y reintenta ante colisión de unicidad (p2002).
 * Se usa como función para no cargar al servicio con el detalle del reintento.
 */
export async function withUniqueCode<T>(
  fn: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn(generateShareSlug(6));
    } catch (error) {
      const isCodeCollision = isUniqueViolation(error);

      if (!isCodeCollision || attempt === MAX_ATTEMPTS) {
        throw error;
      }
    }
  }

  // inalcanzable: el loop siempre retorna o lanza
  throw conflict('no se pudo generar un código único para el aula');
}
