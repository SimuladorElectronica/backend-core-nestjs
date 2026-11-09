import 'reflect-metadata';
import { Role } from '@prisma/client';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

const dto: CreateSubmissionDto = {
  guideId: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
  projectId: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
};

describe('SubmissionsController', () => {
  let controller: SubmissionsController;
  let service: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = { create: vi.fn() };
    controller = new SubmissionsController(
      service as unknown as SubmissionsService,
    );
  });

  it('POST /submissions exige JWT pero no restringe por rol', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.create,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toBeUndefined();
  });

  it('delega la entrega con el id del alumno autenticado', async () => {
    const req = {
      user: { id: 'student-1', email: 'alumno@test.com', role: Role.STUDENT },
    };
    service.create.mockResolvedValue({ id: 's-1' });

    const result = await controller.create(dto, req as never);

    expect(result).toEqual({ id: 's-1' });
    expect(service.create).toHaveBeenCalledWith(dto, 'student-1');
  });
});
