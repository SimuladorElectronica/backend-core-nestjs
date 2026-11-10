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
  let service: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    controller = new SubmissionsController(
      service as unknown as SubmissionsService,
    );
  });

  const guardsOf = (handler: unknown): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, handler as never) as unknown[];

  it('POST /submissions exige JWT pero no restringe por rol', () => {
    const guards = guardsOf(controller.create);

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

  it('GET /submissions exige JWT, pasa el usuario completo y expone el total', async () => {
    const req = {
      user: { id: 'teacher-1', email: 'profe@test.com', role: Role.TEACHER },
    };
    const res = { setHeader: vi.fn() };
    service.findAll.mockResolvedValue({ items: [{ id: 's-1' }], total: 3 });

    expect(guardsOf(controller.findAll)).toContain(JwtAuthGuard);

    const result = await controller.findAll(
      req as never,
      { guideId: dto.guideId },
      res as never,
    );

    expect(result).toEqual([{ id: 's-1' }]);
    expect(service.findAll).toHaveBeenCalledWith(req.user, {
      guideId: dto.guideId,
    });
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 3);
  });

  it('GET /submissions/:id exige JWT y delega con el id del solicitante', async () => {
    const req = {
      user: { id: 'student-1', email: 'alumno@test.com', role: Role.STUDENT },
    };
    service.findOne.mockResolvedValue({ id: 's-1' });

    expect(guardsOf(controller.findOne)).toContain(JwtAuthGuard);

    await controller.findOne('s-1', req as never);

    expect(service.findOne).toHaveBeenCalledWith('s-1', 'student-1');
  });

  it('PUT /submissions/:id exige JWT y delega con el id del solicitante', async () => {
    const req = {
      user: { id: 'student-1', email: 'alumno@test.com', role: Role.STUDENT },
    };
    service.update.mockResolvedValue({ id: 's-1' });

    expect(guardsOf(controller.update)).toContain(JwtAuthGuard);

    await controller.update('s-1', { projectId: dto.projectId }, req as never);

    expect(service.update).toHaveBeenCalledWith(
      's-1',
      { projectId: dto.projectId },
      'student-1',
    );
  });

  it('DELETE /submissions/:id exige JWT y delega con el id del solicitante', async () => {
    const req = {
      user: { id: 'student-1', email: 'alumno@test.com', role: Role.STUDENT },
    };
    service.remove.mockResolvedValue({ message: 'Entrega eliminada', id: 's-1' });

    expect(guardsOf(controller.remove)).toContain(JwtAuthGuard);

    await controller.remove('s-1', req as never);

    expect(service.remove).toHaveBeenCalledWith('s-1', 'student-1');
  });
});
