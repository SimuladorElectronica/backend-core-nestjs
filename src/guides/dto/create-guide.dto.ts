import { TextField, UuidField } from '../../common/decorators/fields.js';

export class CreateGuideDto {
  @TextField({
    description: 'título de la guía didáctica',
    example: 'práctica 1 - led parpadeante',
    maxLength: 200,
  })
  title: string;

  @TextField({
    description: 'instrucciones que debe seguir el alumno',
    example:
      'conectá un led al pin 13 con resistencia de 220 ohm y hacélo parpadear cada segundo',
    maxLength: 10000,
  })
  instructions: string;

  @UuidField({
    example: 'uuid del proyecto plantilla',
    description: 'uuid del proyecto starter sobre el cual parte el alumno',
  })
  starterProjectId: string;

  @UuidField({
    example: 'uuid del aula',
    description:
      'uuid del aula a la que pertenece la guía; solo el docente dueño del aula puede usarla',
  })
  classroomId: string;
}
