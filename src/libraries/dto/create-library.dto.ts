import { TextField } from '../../common/decorators/fields.js';

export class CreateLibraryDto {
  @TextField({
    description: 'nombre único de la librería',
    example: 'liquidcrystal_i2c',
    maxLength: 100,
  })
  name: string;

  @TextField({
    description: 'archivo de cabecera incluido',
    example: 'liquidcrystal_i2c.h',
    maxLength: 100,
  })
  headerFile: string;

  @TextField({ example: 'marcos breuer', maxLength: 100 })
  author: string;

  @TextField({
    description: 'descripción de uso de la librería',
    example: 'pantallas lcd con interface i2c',
    maxLength: 2000,
  })
  description: string;

  @TextField({ example: '1.0.0', minLength: 1, maxLength: 20 })
  version: string;
}
