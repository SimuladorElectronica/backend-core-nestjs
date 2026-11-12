import { OptionalUuidField } from '../../common/decorators/fields.js';

export class ListGuidesQueryDto {
  @OptionalUuidField({
    description: 'filtra las guías por el uuid del docente que las creó',
    example: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
  })
  teacherId?: string;

  @OptionalUuidField({
    description: 'filtra las guías por el uuid del aula; el alcance según rol igual aplica',
    example: '8b7a9f6e-1c2d-4e5f-a6b7-c8d9e0f1a2b3',
  })
  classroomId?: string;
}
