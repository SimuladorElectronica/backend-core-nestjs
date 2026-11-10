import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({
    description: 'Nombre visible del usuario',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico (único en el sistema)',
    example: 'juan.perez@escuela.edu.ar',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
