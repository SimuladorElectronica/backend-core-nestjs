import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GuidesService } from './guides.service.js';
import { GuideAccessService } from './guide-access.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateGuideDto } from '../dto/create-guide.dto.js';

const dto: CreateGuideDto = {
  title: 'Práctica 1 - LED parpadeante',
  instructions: 'Conectá un LED al pin 13 y hacélo parpadear cada segundo.',
  starterProjectId: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
  classroomId: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
};

const teacherUser = { id: 'teacher-1', role: Role.TEACHER };
const adminUser = { id: 'admin-1', role: Role.ADMIN };

describe('GuidesService', () => {
  let service: GuidesService;
  let prisma: {
    guide: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    project: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    classroom: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    classroomStudent: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      guide: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      project: {
        findUnique: vi.fn(),
      },
      classroom: {
        findUnique: vi.fn(),
      },
      classroomStudent: {
        findUnique: vi.fn(),
      },
    };
    const prismaService = prisma as unknown as PrismaService;
    service = new GuidesService(prismaService, new GuideAccessService(prismaService));
  });

  describe('create', () => {
    it('crea una guía vinculada a la docente, el aula y el proyecto plantilla', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: dto.starterProjectId });
      prisma.classroom.findUnique.mockResolvedValue({
        id: dto.classroomId,
        teacherId: 'teacher-1',
      });
      prisma.guide.create.mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ id: 'g-1', ...data }),
      );

      const result = await service.create(dto, 'teacher-1');

      expect(result.id).toBe('g-1');
      expect(prisma.guide.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: dto.title,
            instructions: dto.instructions,
            starterProjectId: dto.starterProjectId,
            classroomId: dto.classroomId,
            teacherId: 'teacher-1',
          }),
        }),
      );
    });

    it('lanza 404 si el proyecto plantilla no existe', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.guide.create).not.toHaveBeenCalled();
    });

    it('lanza 404 si el aula no existe', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: dto.starterProjectId });
      prisma.classroom.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.guide.create).not.toHaveBeenCalled();
    });

    it('lanza 403 si el aula pertenece a otro docente', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: dto.starterProjectId });
      prisma.classroom.findUnique.mockResolvedValue({
        id: dto.classroomId,
        teacherId: 'otro-teacher',
      });

      await expect(service.create(dto, 'teacher-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.guide.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('admin ve todas las guías', async () => {
      prisma.guide.findMany.mockResolvedValue([]);

      await service.findAll({}, adminUser);

      expect(prisma.guide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('docente ve las guías de las aulas que creó', async () => {
      prisma.guide.findMany.mockResolvedValue([]);

      await service.findAll({}, teacherUser);

      expect(prisma.guide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classroom: { teacherId: 'teacher-1' } },
        }),
      );
    });

    it('alumno ve las guías de las aulas en las que está inscripto', async () => {
      prisma.guide.findMany.mockResolvedValue([]);

      await service.findAll({}, { id: 's-1', role: Role.STUDENT });

      expect(prisma.guide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classroom: { students: { some: { studentId: 's-1' } } } },
        }),
      );
    });

    it('filtro por aula y docente dentro del alcance', async () => {
      prisma.guide.findMany.mockResolvedValue([]);

      await service.findAll(
        { teacherId: 'teacher-9', classroomId: dto.classroomId },
        teacherUser,
      );

      expect(prisma.guide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            classroom: { teacherId: 'teacher-1' },
            teacherId: 'teacher-9',
            classroomId: dto.classroomId,
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('admin ve cualquier guía', async () => {
      const guide = { id: 'g-1', teacherId: 'teacher-9', classroomId: dto.classroomId };
      prisma.guide.findUnique.mockResolvedValue(guide);

      await expect(service.findOne('g-1', adminUser)).resolves.toEqual(guide);
    });

    it('el docente dueño ve su guía', async () => {
      const guide = { id: 'g-1', teacherId: 'teacher-1', classroomId: dto.classroomId };
      prisma.guide.findUnique.mockResolvedValue(guide);

      await expect(service.findOne('g-1', teacherUser)).resolves.toEqual(guide);
    });

    it('un alumno inscripto en el aula ve la guía', async () => {
      const guide = { id: 'g-1', teacherId: 'teacher-9', classroomId: dto.classroomId };
      prisma.guide.findUnique.mockResolvedValue(guide);
      prisma.classroomStudent.findUnique.mockResolvedValue({
        classroomId: dto.classroomId,
        studentId: 's-1',
      });

      await expect(
        service.findOne('g-1', { id: 's-1', role: Role.STUDENT }),
      ).resolves.toEqual(guide);
    });

    it('un alumno NO inscripto no puede ver la guía (404)', async () => {
      const guide = { id: 'g-1', teacherId: 'teacher-9', classroomId: dto.classroomId };
      prisma.guide.findUnique.mockResolvedValue(guide);
      prisma.classroomStudent.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('g-1', { id: 's-1', role: Role.STUDENT }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si la guía no existe', async () => {
      prisma.guide.findUnique.mockResolvedValue(null);

      await expect(service.findOne('faltante', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('lanza 404 si la guía no existe', async () => {
      prisma.guide.findUnique.mockResolvedValue(null);

      await expect(
        service.update('faltante', { title: 'Nuevo' }, 'teacher-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.guide.update).not.toHaveBeenCalled();
    });

    it('lanza 403 si la guía pertenece a otro docente', async () => {
      prisma.guide.findUnique.mockResolvedValue({
        id: 'g-1',
        teacherId: 'otro-teacher',
      });

      await expect(
        service.update('g-1', { title: 'Nuevo' }, 'teacher-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.guide.update).not.toHaveBeenCalled();
    });

    it('actualiza los campos enviados de una guía propia', async () => {
      prisma.guide.findUnique.mockResolvedValue({
        id: 'g-1',
        teacherId: 'teacher-1',
      });
      prisma.guide.update.mockResolvedValue({
        id: 'g-1',
        teacherId: 'teacher-1',
        title: 'Título editado',
      });

      const result = await service.update(
        'g-1',
        { title: 'Título editado' },
        'teacher-1',
      );

      expect(result.title).toBe('Título editado');
      expect(prisma.guide.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'g-1' },
          data: { title: 'Título editado' },
        }),
      );
    });

    it('acepta cambiar el proyecto plantilla si existe', async () => {
      prisma.guide.findUnique.mockResolvedValue({
        id: 'g-1',
        teacherId: 'teacher-1',
      });
      prisma.project.findUnique.mockResolvedValue({ id: dto.starterProjectId });
      prisma.guide.update.mockResolvedValue({ id: 'g-1' });

      await service.update(
        'g-1',
        { starterProjectId: dto.starterProjectId },
        'teacher-1',
      );

      expect(prisma.guide.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            starterProject: { connect: { id: dto.starterProjectId } },
          },
        }),
      );
    });

    it('lanza 404 si el nuevo proyecto plantilla no existe', async () => {
      prisma.guide.findUnique.mockResolvedValue({
        id: 'g-1',
        teacherId: 'teacher-1',
      });
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'g-1',
          { starterProjectId: dto.starterProjectId },
          'teacher-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.guide.update).not.toHaveBeenCalled();
    });

    it('rechaza mover la guía a un aula ajena (403)', async () => {
      prisma.guide.findUnique.mockResolvedValue({
        id: 'g-1',
        teacherId: 'teacher-1',
      });
      prisma.classroom.findUnique.mockResolvedValue({
        id: dto.classroomId,
        teacherId: 'otro-teacher',
      });

      await expect(
        service.update('g-1', { classroomId: dto.classroomId }, 'teacher-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.guide.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lanza 404 si la guía no existe', async () => {
      prisma.guide.findUnique.mockResolvedValue(null);

      await expect(service.remove('faltante', 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.guide.delete).not.toHaveBeenCalled();
    });

    it('lanza 403 si la guía pertenece a otro docente', async () => {
      prisma.guide.findUnique.mockResolvedValue({
        id: 'g-1',
        teacherId: 'otro-teacher',
      });

      await expect(service.remove('g-1', 'teacher-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.guide.delete).not.toHaveBeenCalled();
    });

    it('elimina una guía propia', async () => {
      prisma.guide.findUnique.mockResolvedValue({
        id: 'g-1',
        teacherId: 'teacher-1',
      });
      prisma.guide.delete.mockResolvedValue({ id: 'g-1' });

      const result = await service.remove('g-1', 'teacher-1');

      expect(result.id).toBe('g-1');
      expect(prisma.guide.delete).toHaveBeenCalledWith({
        where: { id: 'g-1' },
      });
    });
  });
});
