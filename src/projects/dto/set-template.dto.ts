import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetTemplateDto {
  @ApiProperty({
    example: true,
    description:
      'marca (true) o desmarca (false) el proyecto como plantilla pública del simulador',
  })
  @IsBoolean()
  isTemplate: boolean;
}