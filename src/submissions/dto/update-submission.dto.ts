import { UuidField } from '../../common/decorators/fields.js';

/**
 * solo se puede reemplazar el proyecto entregado (la guía no cambia).
 * el proyecto nuevo debe existir y pertenecer al alumno que edita
 */
export class UpdateSubmissionDto {
  @UuidField({
    description: 'uuid del proyecto propio del alumno que reemplaza la entrega',
    example: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
  })
  projectId: string;
}
