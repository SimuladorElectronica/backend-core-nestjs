import { randomBytes } from 'node:crypto';

/** Alfabeto sin caracteres ambiguos: 36^6 ≈ 2.180 millones de combinaciones */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const SHARE_SLUG_LENGTH = 6;

/**
 * Genera un shareSlug único de 6 caracteres (ej: "a9f3b2")
 * usando criptografía segura de Node (sin dependencias externas).
 */
export function generateShareSlug(length: number = SHARE_SLUG_LENGTH): string {
  const bytes = randomBytes(length);
  let slug = '';

  for (let i = 0; i < length; i++) {
    slug += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return slug;
}
