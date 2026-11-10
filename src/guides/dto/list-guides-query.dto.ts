import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListGuidesQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra las guías por el UUID del docente que las creó',
    example: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
