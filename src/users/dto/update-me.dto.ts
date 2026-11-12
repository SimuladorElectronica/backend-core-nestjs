import {
  OptionalEmailField,
  OptionalTextField,
} from '../../common/decorators/fields.js';

export class UpdateMeDto {
  @OptionalTextField({
    description: 'nombre visible del usuario',
    example: 'juan pérez',
    maxLength: 120,
  })
  name?: string;

  @OptionalEmailField({ example: 'juan@escuela.edu.ar' })
  email?: string;
}
