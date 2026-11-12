import { EmailField, TextField } from '../../common/decorators/fields.js';

export class RegisterDto {
  @TextField({ example: 'juan pérez', maxLength: 120 })
  name: string;

  @EmailField({ example: 'estudiante@escuela.edu.ar' })
  email: string;

  /** bcrypt/argon2 hacen su propio largo máximo; se exige un mínimo sano */
  @TextField({ example: 'password_segura', minLength: 8 })
  password: string;
}
