import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Paginación por offset común a los listados.
 * `skip`/`take` se documentan también en el header `X-Total-Count`.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Cantidad máxima de registros a devolver',
    type: Number,
    default: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  take?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de registros a omitir (paginación por offset)',
    type: Number,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

/** Forma estándar de los listados paginados dentro de los servicios */
export interface Paginated<T> {
  items: T[];
  total: number;
}

/** Resuelve los valores de paginación con los defaults del proyecto */
export function resolvePagination(query: PaginationQueryDto = {}): {
  take: number;
  skip: number;
} {
  return {
    take: query.take ?? DEFAULT_PAGE_SIZE,
    skip: query.skip ?? 0,
  };
}
