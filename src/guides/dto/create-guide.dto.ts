import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateGuideDto {
  @ApiProperty({
    description: 'Título de la guía didáctica',
    example: 'Práctica 1 - LED parpadeante',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Instrucciones que debe seguir el alumno',
    example:
      'Conectá un LED al pin 13 con resistencia de 220Ω y hacélo parpadear cada segundo.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  instructions: string;

  @ApiProperty({
    description:
      'UUID del proyecto plantilla (starter) sobre el cual el alumno parte',
    example: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
  })
  @IsUUID()
  starterProjectId: string;
}
