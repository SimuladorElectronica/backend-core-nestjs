import { OptionalUuidField } from '../../common/decorators/fields.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListSubmissionsQueryDto extends PaginationQueryDto {
  @OptionalUuidField({
    description: 'filtra las entregas por el uuid de la guía',
    example: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
  })
  guideId?: string;
}
