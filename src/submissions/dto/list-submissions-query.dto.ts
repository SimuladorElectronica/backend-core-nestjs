import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListSubmissionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra las entregas por el UUID de la guía',
    example: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
  })
  @IsOptional()
  @IsUUID()
  guideId?: string;
}
