import 'reflect-metadata';
import { Role } from '@prisma/client';
import {
  SubmissionsReadController,
  SubmissionsWriteController,
} from './submissions.controller.js';
import { SubmissionsService } from '../services/submissions.service.js';
import { CreateSubmissionDto } from '../dto/create-submission.dto.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { rolesKey } from '../../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

const dto: CreateSubmissionDto = {
  guideId: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
  projectId: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
};

const student = { id: 'student-1', email: 'alumno@test.com', role: Role.STUDENT };

describe('SubmissionsController', () => {
  let read: SubmissionsReadController;
  let write: SubmissionsWriteController;
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
    read = new SubmissionsReadController(service as unknown as SubmissionsService);
    write = new SubmissionsWriteController(service as unknown as SubmissionsService);
  });

  const guardsOf = (handler: unknown): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, handler as never) as unknown[];

  it('POST /submissions exige JWT pero no restringe por rol', () => {
    const guards = guardsOf(write.create);

    expect(guards).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(rolesKey, write.create)).toBeUndefined();
  });

  it('delega la entrega con el id del alumno autenticado', async () => {
    service.create.mockResolvedValue({ id: 's-1' });

    const result = await write.create(dto, student);

    expect(result).toEqual({ id: 's-1' });
    expect(service.create).toHaveBeenCalledWith(dto, 'student-1');
  });

  it('GET /submissions exige JWT, pasa el usuario completo y expone el total', async () => {
    const teacher = { id: 'teacher-1', email: 'profe@test.com', role: Role.TEACHER };
    const res = { setHeader: vi.fn() };
    service.findAll.mockResolvedValue({ items: [{ id: 's-1' }], total: 3 });

    expect(guardsOf(read.findAll)).toContain(JwtAuthGuard);

    const result = await read.findAll(
      teacher,
      { guideId: dto.guideId },
      res as never,
    );

    expect(result).toEqual([{ id: 's-1' }]);
    expect(service.findAll).toHaveBeenCalledWith(teacher, {
      guideId: dto.guideId,
    });
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 3);
  });

  it('GET /submissions/:id exige JWT y delega con el id del solicitante', async () => {
    service.findOne.mockResolvedValue({ id: 's-1' });

    expect(guardsOf(read.findOne)).toContain(JwtAuthGuard);

    await read.findOne('s-1', student);

    expect(service.findOne).toHaveBeenCalledWith('s-1', student);
  });

  it('PUT /submissions/:id exige JWT y delega con el id del solicitante', async () => {
    service.update.mockResolvedValue({ id: 's-1' });

    expect(guardsOf(write.update)).toContain(JwtAuthGuard);

    await write.update('s-1', { projectId: dto.projectId }, student);

    expect(service.update).toHaveBeenCalledWith(
      's-1',
      { projectId: dto.projectId },
      'student-1',
    );
  });

  it('DELETE /submissions/:id exige JWT y delega con el id del solicitante', async () => {
    service.remove.mockResolvedValue({ message: 'entrega eliminada', id: 's-1' });

    expect(guardsOf(write.remove)).toContain(JwtAuthGuard);

    await write.remove('s-1', student);

    expect(service.remove).toHaveBeenCalledWith('s-1', 'student-1');
  });
});
