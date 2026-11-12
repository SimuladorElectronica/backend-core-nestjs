import { EmailField, TextField } from '../../common/decorators/fields.js';

export class LoginDto {
  @EmailField({ example: 'estudiante@escuela.edu.ar' })
  email: string;

  @TextField({ example: 'password_segura' })
  password: string;
}
