import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListLibrariesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Busca por nombre de librería o autor',
    example: 'LiquidCrystal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
