import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'Nuevo rol del usuario',
    enum: Role,
    example: Role.TEACHER,
  })
  @IsEnum(Role)
  role: Role;
}
