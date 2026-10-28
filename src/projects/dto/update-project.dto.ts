import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto.js';

/**
 * Todos los campos son opcionales: solo se actualizan los enviados.
 * (circuitData y code también admiten actualización parcial)
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
