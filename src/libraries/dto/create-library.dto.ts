import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLibraryDto {
  @ApiProperty({
    description: 'Nombre único de la librería',
    example: 'LiquidCrystal_I2C',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Archivo de cabecera incluido',
    example: 'LiquidCrystal_I2C.h',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  headerFile: string;

  @ApiProperty({ example: 'Marcos Breuer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  author: string;

  @ApiProperty({
    description: 'Descripción de uso de la librería',
    example: 'Pantallas LCD con interface I2C',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  version: string;
}
