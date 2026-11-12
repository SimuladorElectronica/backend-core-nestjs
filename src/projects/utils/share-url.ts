/** Arma la URL pública de un proyecto a partir de su shareSlug. */
export function buildShareUrl(shareSlug: string): string {
  const baseUrl =
    process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';
  return `${baseUrl}/share/${shareSlug}`;
}
