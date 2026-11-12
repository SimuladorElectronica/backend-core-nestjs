import { TextField } from '../../common/decorators/fields.js';

export class CreateClassroomDto {
  @TextField({
    description: 'nombre del aula',
    example: '5to año — comisión A',
    maxLength: 120,
  })
  name: string;
}
