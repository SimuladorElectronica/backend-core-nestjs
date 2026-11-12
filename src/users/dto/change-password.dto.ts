import { TextField } from '../../common/decorators/fields.js';

export class ChangePasswordDto {
  @TextField({
    description: 'contraseña actual del usuario autenticado',
    example: 'password_actual',
    maxLength: 128,
  })
  currentPassword: string;

  @TextField({
    description: 'nueva contraseña (mínimo 8 caracteres)',
    example: 'password_nueva',
    minLength: 8,
    maxLength: 128,
  })
  newPassword: string;
}
