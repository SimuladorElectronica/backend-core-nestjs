import { Role } from '@prisma/client';
import { EnumField } from '../../common/decorators/fields.js';

export class UpdateRoleDto {
  @EnumField({
    enum: Role,
    example: 'TEACHER',
    description: 'nuevo rol del usuario',
  })
  role: Role;
}
