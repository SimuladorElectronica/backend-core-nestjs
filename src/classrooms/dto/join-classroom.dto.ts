import { TextField } from '../../common/decorators/fields.js';

export class JoinClassroomDto {
  @TextField({
    description: 'código de unión del aula (6 caracteres)',
    example: 'a9f3b2',
    minLength: 4,
    maxLength: 12,
  })
  code: string;
}
