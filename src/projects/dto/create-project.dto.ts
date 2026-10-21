import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiPropertyOptional({
    description: 'Título del proyecto',
    example: 'Amplificador operacional',
    default: 'Circuito sin título',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Descripción opcional del circuito',
    example: 'Práctica 3 - fuente de tensión',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description:
      'Estructura JSONB del esquemático: grafo de componentes 2D, coordenadas, cables y propiedades',
    example: {
      components: [
        { id: 'r1', type: 'resistor', x: 120, y: 80, value: 1000 },
        { id: 'v1', type: 'vcc', x: 40, y: 80, value: 5 },
      ],
      wires: [{ from: 'v1:+', to: 'r1:1' }],
    },
  })
  @IsObject()
  @IsNotEmpty()
  circuitData: Record<string, unknown>;

  @ApiProperty({
    description: 'Código C++ (Arduino Core) asociado al circuito',
    example: 'void setup() { pinMode(13, OUTPUT); }',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'Si es falso, el proyecto no se puede abrir por shareSlug',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
