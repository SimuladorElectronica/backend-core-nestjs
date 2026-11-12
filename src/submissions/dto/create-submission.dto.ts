import { UuidField } from '../../common/decorators/fields.js';

export class CreateSubmissionDto {
  @UuidField({
    description: 'uuid de la guía a la que se entrega el trabajo',
    example: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
  })
  guideId: string;

  @UuidField({
    description: 'uuid del proyecto propio del alumno que se entrega',
    example: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
  })
  projectId: string;
}
