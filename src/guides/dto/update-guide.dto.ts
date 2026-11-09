import { PartialType } from '@nestjs/swagger';
import { CreateGuideDto } from './create-guide.dto.js';

/** Solo se actualizan los campos enviados */
export class UpdateGuideDto extends PartialType(CreateGuideDto) {}
