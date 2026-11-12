import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClassroomsService } from './classrooms.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const classroomId = '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61';
const otherId = '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d';

const teacher = { id: 'teacher-1', role: Role.TEACHER };
const otherTeacher = { id: 'teacher-2', role: Role.TEACHER };
const admin = { id: 'admin-1', role: Role.ADMIN };
const student = { id: 'student-1', role: Role.STUDENT };

const meta = {
  teacher: { id: 'teacher-1', name: 'profe' },
  _count: { students: 3, guides: 2 },
};

const classroom = {
  id: classroomId,
  name: '5to a comisión a',
  code: 'a9f3b2',
  teacherId: 'teacher-1',
  createdAt: new Date('2026-11-01'),
  ...meta,
};

describe('ClassroomsService', () => {
  let service: ClassroomsService;
  let prisma: {
    classroom: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    classroomStudent: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      classroom: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      classroomStudent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new ClassroomsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('crea el aula con código y expone el code al docente dueño', async () => {
      prisma.classroom.create.mockImplementation(
        ({ data }: { data: { name: string; teacherId: string; code: string } }) =>
          Promise.resolve({
            ...classroom,
            id: 'new-id',
            name: data.name,
            code: data.code,
          }),
      );

      const result = await service.create({ name: '5to a' }, 'teacher-1');

      expect(result.name).toBe('5to a');
      expect(result.memberCount).toBe(3);
      expect(result.guideCount).toBe(2);
      expect(result.code).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('el admin lista todas las aulas (con code)', async () => {
      prisma.classroom.findMany.mockResolvedValue([classroom]);

      const result = await service.findAll(admin);

      expect(prisma.classroom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result[0].code).toBe('a9f3b2');
    });

    it('el docente lista las que creó (con code)', async () => {
      prisma.classroom.findMany.mockResolvedValue([classroom]);

      const result = await service.findAll(teacher);

      expect(prisma.classroom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teacherId: 'teacher-1' } }),
      );
      expect(result[0].code).toBe('a9f3b2');
    });

    it('el alumno lista las que cursa (sin code)', async () => {
      prisma.classroom.findMany.mockResolvedValue([classroom]);

      const result = await service.findAll(student);

      expect(prisma.classroom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { students: { some: { studentId: 'student-1' } } },
        }),
      );
      expect(result[0].code).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('el docente dueño ve el code', async () => {
      prisma.classroom.findUnique.mockResolvedValue(classroom);

      const result = await service.findOne(classroomId, teacher);

      expect(result.code).toBe('a9f3b2');
    });

    it('un alumno inscripto ve el detalle pero NO el code', async () => {
      prisma.classroom.findUnique.mockResolvedValue(classroom);
      prisma.classroomStudent.findUnique.mockResolvedValue({
        classroomId,
        studentId: 'student-1',
      });

      const result = await service.findOne(classroomId, student);

      expect(result.code).toBeUndefined();
      expect(result.memberCount).toBe(3);
    });

    it('un alumno NO inscripto recibe 404', async () => {
      prisma.classroom.findUnique.mockResolvedValue(classroom);
      prisma.classroomStudent.findUnique.mockResolvedValue(null);

      await expect(service.findOne(classroomId, student)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza 404 si el aula no existe', async () => {
      prisma.classroom.findUnique.mockResolvedValue(null);

      await expect(service.findOne(otherId, admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listStudents', () => {
    const view = {
      id: classroomId,
      teacherId: 'teacher-1',
      students: [
        {
          joinedAt: new Date('2026-11-02'),
          student: { id: 'student-1', name: 'ana', email: 'a@test.com' },
        },
      ],
    };

    it('el docente dueño lista los alumnos con su fecha de ingreso', async () => {
      prisma.classroom.findUnique.mockResolvedValue(view);

      const result = await service.listStudents(classroomId, teacher);

      expect(result).toEqual([
        { id: 'student-1', name: 'ana', email: 'a@test.com', joinedAt: view.students[0].joinedAt },
      ]);
    });

    it('el admin puede listar los alumnos', async () => {
      prisma.classroom.findUnique.mockResolvedValue(view);

      await expect(
        service.listStudents(classroomId, admin),
      ).resolves.toHaveLength(1);
    });

    it('otro docente recibe 403', async () => {
      prisma.classroom.findUnique.mockResolvedValue(view);

      await expect(
        service.listStudents(classroomId, otherTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza 404 si el aula no existe', async () => {
      prisma.classroom.findUnique.mockResolvedValue(null);

      await expect(service.listStudents(otherId, teacher)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('join', () => {
    it('inscribe al alumno con un código válido', async () => {
      prisma.classroom.findUnique.mockResolvedValue(classroom);
      prisma.classroomStudent.findUnique.mockResolvedValue(null);
      prisma.classroomStudent.create.mockResolvedValue({ classroomId });
      prisma.classroom.findUniqueOrThrow.mockResolvedValue(classroom);

      const result = await service.join('a9f3b2', 'student-1');

      expect(prisma.classroomStudent.create).toHaveBeenCalledWith({
        data: { classroomId, studentId: 'student-1' },
      });
      expect(result.code).toBeUndefined();
    });

    it('lanza 404 si el código no corresponde a ningún aula', async () => {
      prisma.classroom.findUnique.mockResolvedValue(null);

      await expect(service.join('zzzzzz', 'student-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.classroomStudent.create).not.toHaveBeenCalled();
    });

    it('lanza 409 si el alumno ya está inscripto', async () => {
      prisma.classroom.findUnique.mockResolvedValue(classroom);
      prisma.classroomStudent.findUnique.mockResolvedValue({
        classroomId,
        studentId: 'student-1',
      });

      await expect(service.join('a9f3b2', 'student-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.classroomStudent.create).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    const own = { id: classroomId, teacherId: 'teacher-1' };

    it('el docente dueño puede quitar a un alumno', async () => {
      prisma.classroom.findUnique.mockResolvedValue(own);
      prisma.classroomStudent.findUnique.mockResolvedValue({
        classroomId,
        studentId: 'student-1',
      });

      const result = await service.removeMember(classroomId, 'student-1', teacher);

      expect(result.message).toContain('removido');
      expect(prisma.classroomStudent.delete).toHaveBeenCalledWith({
        where: { classroomId_studentId: { classroomId, studentId: 'student-1' } },
      });
    });

    it('un alumno puede quitarse a sí mismo ("dejar el aula")', async () => {
      prisma.classroom.findUnique.mockResolvedValue(own);
      prisma.classroomStudent.findUnique.mockResolvedValue({
        classroomId,
        studentId: 'student-1',
      });

      const result = await service.removeMember(classroomId, 'student-1', student);

      expect(result.message).toContain('retiraste');
    });

    it('un alumno no puede quitar a otro (403)', async () => {
      prisma.classroom.findUnique.mockResolvedValue(own);

      await expect(
        service.removeMember(classroomId, 'otro-alumno', student),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.classroomStudent.delete).not.toHaveBeenCalled();
    });

    it('lanza 404 si el alumno no está inscripto', async () => {
      prisma.classroom.findUnique.mockResolvedValue(own);
      prisma.classroomStudent.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember(classroomId, 'student-1', teacher),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('regenerateCode', () => {
    it('el docente dueño regenera el código', async () => {
      prisma.classroom.findUnique.mockResolvedValue({ id: classroomId, teacherId: 'teacher-1' });
      prisma.classroom.update.mockResolvedValue({ id: classroomId, code: 'nuevo1' });

      const result = await service.regenerateCode(classroomId, teacher);

      expect(result).toEqual({ id: classroomId, code: 'nuevo1' });
    });

    it('otro docente recibe 403', async () => {
      prisma.classroom.findUnique.mockResolvedValue({ id: classroomId, teacherId: 'teacher-1' });

      await expect(
        service.regenerateCode(classroomId, otherTeacher),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.classroom.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina el aula si no tiene guías', async () => {
      prisma.classroom.findUnique.mockResolvedValue({
        ...ownRoom(),
        _count: { guides: 0 },
      });

      const result = await service.remove(classroomId, teacher);

      expect(result.id).toBe(classroomId);
      expect(prisma.classroom.delete).toHaveBeenCalledWith({
        where: { id: classroomId },
      });
    });

    it('lanza 409 si el aula tiene guías', async () => {
      prisma.classroom.findUnique.mockResolvedValue({
        ...ownRoom(),
        _count: { guides: 2 },
      });

      await expect(service.remove(classroomId, teacher)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.classroom.delete).not.toHaveBeenCalled();
    });

    it('lanza 404 si el aula no existe', async () => {
      prisma.classroom.findUnique.mockResolvedValue(null);

      await expect(service.remove(otherId, teacher)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('otro docente recibe 403', async () => {
      prisma.classroom.findUnique.mockResolvedValue({
        ...ownRoom(),
        _count: { guides: 0 },
      });

      await expect(service.remove(classroomId, otherTeacher)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.classroom.delete).not.toHaveBeenCalled();
    });

    function ownRoom() {
      return { id: classroomId, name: '5to a', code: 'a9f3b2', teacherId: 'teacher-1', createdAt: new Date() };
    }
  });
});
