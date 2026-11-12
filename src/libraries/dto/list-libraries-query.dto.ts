import { OptionalTextField } from '../../common/decorators/fields.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListLibrariesQueryDto extends PaginationQueryDto {
  @OptionalTextField({
    description: 'busca por nombre de librería o autor',
    example: 'liquidcrystal',
    maxLength: 100,
  })
  q?: string;
}
