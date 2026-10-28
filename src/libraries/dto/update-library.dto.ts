import { PartialType } from '@nestjs/swagger';
import { CreateLibraryDto } from './create-library.dto.js';

/** Solo se actualizan los campos enviados */
export class UpdateLibraryDto extends PartialType(CreateLibraryDto) {}
