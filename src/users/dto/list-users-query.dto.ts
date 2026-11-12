import { Role } from '@prisma/client';
import { OptionalTextField, EnumOptionalField } from '../../common/decorators/fields.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @EnumOptionalField({
    enum: Role,
    example: 'STUDENT',
    description: 'filtra por rol',
  })
  role?: Role;

  @OptionalTextField({
    description: 'busca por nombre o email (sin distinguir mayúsculas)',
    example: 'alumno',
    maxLength: 100,
  })
  search?: string;
}
