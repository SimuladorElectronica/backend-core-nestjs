import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por rol',
    enum: Role,
    example: Role.STUDENT,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Busca por nombre o email (sin distinguir mayúsculas)',
    example: 'alumno',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
