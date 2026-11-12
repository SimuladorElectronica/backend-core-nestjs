import 'reflect-metadata';
import { Role } from '@prisma/client';
import {
  ClassroomsReadController,
  ClassroomsWriteController,
} from './classrooms.controller.js';
import { ClassroomsService } from '../services/classrooms.service.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { rolesKey } from '../../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

const teacher = { id: 'teacher-1', role: Role.TEACHER };
const student = { id: 'student-1', role: Role.STUDENT };

describe('ClassroomsController', () => {
  let read: ClassroomsReadController;
  let write: ClassroomsWriteController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    listStudents: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    join: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
    regenerateCode: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      listStudents: vi.fn(),
      create: vi.fn(),
      join: vi.fn(),
      removeMember: vi.fn(),
      regenerateCode: vi.fn(),
      remove: vi.fn(),
    };
    read = new ClassroomsReadController(service as unknown as ClassroomsService);
    write = new ClassroomsWriteController(service as unknown as ClassroomsService);
  });

  const guardsOf = (handler: unknown): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, handler as never) as unknown[];

  it('GET /classrooms exige JWT y delega con el usuario', async () => {
    expect(guardsOf(read.findAll)).toContain(JwtAuthGuard);
    service.findAll.mockResolvedValue([]);

    await read.findAll(teacher);

    expect(service.findAll).toHaveBeenCalledWith(teacher);
  });

  it('GET /classrooms/:id exige JWT y delega con id y usuario', async () => {
    expect(guardsOf(read.findOne)).toContain(JwtAuthGuard);
    service.findOne.mockResolvedValue({ id: 'c-1' });

    await read.findOne('c-1', teacher);

    expect(service.findOne).toHaveBeenCalledWith('c-1', teacher);
  });

  it('GET /classrooms/:id/students exige JWT y delega', async () => {
    expect(guardsOf(read.listStudents)).toContain(JwtAuthGuard);
    service.listStudents.mockResolvedValue([]);

    await expect(read.listStudents('c-1', teacher)).resolves.toEqual([]);
    expect(service.listStudents).toHaveBeenCalledWith('c-1', teacher);
  });

  it('POST /classrooms exige rol TEACHER', () => {
    expect(guardsOf(write.create)).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(rolesKey, write.create)).toEqual([
      Role.TEACHER,
    ]);
  });

  it('POST /classrooms delega con el id del creador', async () => {
    service.create.mockResolvedValue({ id: 'c-1' });

    await expect(write.create({ name: '5to a' }, teacher)).resolves.toEqual({
      id: 'c-1',
    });
    expect(service.create).toHaveBeenCalledWith({ name: '5to a' }, 'teacher-1');
  });

  it('POST /classrooms/join exige rol STUDENT y delega', () => {
    expect(guardsOf(write.join)).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(rolesKey, write.join)).toEqual([Role.STUDENT]);
  });

  it('POST /classrooms/join delega el código y el id del alumno', async () => {
    service.join.mockResolvedValue({ id: 'c-1' });

    await expect(write.join({ code: 'a9f3b2' }, student)).resolves.toEqual({
      id: 'c-1',
    });
    expect(service.join).toHaveBeenCalledWith('a9f3b2', 'student-1');
  });

  it('POST /classrooms/:id/regenerate-code exige JWT y delega', async () => {
    expect(guardsOf(write.regenerateCode)).toContain(JwtAuthGuard);
    service.regenerateCode.mockResolvedValue({ id: 'c-1', code: 'nuevo1' });

    await expect(write.regenerateCode('c-1', teacher)).resolves.toEqual({
      id: 'c-1',
      code: 'nuevo1',
    });
    expect(service.regenerateCode).toHaveBeenCalledWith('c-1', teacher);
  });

  it('DELETE /classrooms/:id/students/:studentId exige JWT y delega', async () => {
    expect(guardsOf(write.removeMember)).toContain(JwtAuthGuard);
    service.removeMember.mockResolvedValue({ classroomId: 'c-1' });

    await write.removeMember('c-1', 'student-1', teacher);

    expect(service.removeMember).toHaveBeenCalledWith('c-1', 'student-1', teacher);
  });

  it('DELETE /classrooms/:id exige JWT y delega', async () => {
    expect(guardsOf(write.remove)).toContain(JwtAuthGuard);
    service.remove.mockResolvedValue({ id: 'c-1' });

    await write.remove('c-1', teacher);

    expect(service.remove).toHaveBeenCalledWith('c-1', teacher);
  });
});
