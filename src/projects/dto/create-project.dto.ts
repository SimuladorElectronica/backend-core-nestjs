import {
  BooleanQueryField,
  ObjectField,
  OptionalTextField,
  TextField,
} from '../../common/decorators/fields.js';

export class CreateProjectDto {
  @OptionalTextField({
    description: 'título del proyecto',
    example: 'amplificador operacional',
    maxLength: 200,
  })
  title?: string;

  @OptionalTextField({
    description: 'descripción opcional del circuito',
    example: 'práctica 3 - fuente de tensión',
    maxLength: 2000,
  })
  description?: string;

  @ObjectField({
    example: {
      components: [
        { id: 'r1', type: 'resistor', x: 120, y: 80, value: 1000 },
        { id: 'v1', type: 'vcc', x: 40, y: 80, value: 5 },
      ],
      wires: [{ from: 'v1:+', to: 'r1:1' }],
    },
    description: 'estructura jsonb: componentes, coordenadas, cables y propiedades',
  })
  circuitData: Record<string, unknown>;

  @TextField({
    description: 'código c++ (arduino core) asociado al circuito',
    example: 'void setup() {}',
  })
  code: string;

  @BooleanQueryField({ example: true })
  isPublic?: boolean;
}
