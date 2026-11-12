import { IntQueryField } from '../decorators/fields.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** paginación por offset común a los listados */
export class PaginationQueryDto {
  @IntQueryField({
    description: 'cantidad máxima de registros a devolver',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    defaultValue: DEFAULT_PAGE_SIZE,
  })
  take?: number;

  @IntQueryField({
    description: 'cantidad de registros a omitir (offset)',
    minimum: 0,
    defaultValue: 0,
  })
  skip?: number;
}

/** forma estándar de los listados paginados dentro de los servicios */
export interface Paginated<T> {
  items: T[];
  total: number;
}

/** resuelve los valores de paginación con los defaults del proyecto */
export function resolvePagination(query: PaginationQueryDto = {}): {
  take: number;
  skip: number;
} {
  return {
    take: query.take ?? DEFAULT_PAGE_SIZE,
    skip: query.skip ?? 0,
  };
}
