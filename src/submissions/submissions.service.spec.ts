import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SubmissionsService } from './submissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';

const dto: CreateSubmissionDto = {
  guideId: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
  projectId: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
};

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let prisma: {
    guide: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    project: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    submission: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      guide: { findUnique: vi.fn() },
      project: { findUnique: vi.fn() },
      submission: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new SubmissionsService(prisma as unknown as PrismaService);
  });

  it('registra la entrega de un proyecto propio del alumno', async () => {
    prisma.guide.findUnique.mockResolvedValue({ id: dto.guideId });
    prisma.project.findUnique.mockResolvedValue({
      id: dto.projectId,
      userId: 'student-1',
    });
    prisma.submission.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ id: 's-1', ...data }),
    );

    const result = await service.create(dto, 'student-1');

    expect(result.id).toBe('s-1');
    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guideId: dto.guideId,
          projectId: dto.projectId,
          studentId: 'student-1',
        }),
      }),
    );
  });

  it('lanza 404 si la guía no existe', async () => {
    prisma.guide.findUnique.mockResolvedValue(null);

    await expect(service.create(dto, 'student-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  it('lanza 404 si el proyecto no existe', async () => {
    prisma.guide.findUnique.mockResolvedValue({ id: dto.guideId });
    prisma.project.findUnique.mockResolvedValue(null);

    await expect(service.create(dto, 'student-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  it('lanza 403 si el proyecto pertenece a otro usuario', async () => {
    prisma.guide.findUnique.mockResolvedValue({ id: dto.guideId });
    prisma.project.findUnique.mockResolvedValue({
      id: dto.projectId,
      userId: 'otro-alumno',
    });

    await expect(service.create(dto, 'student-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  it('lanza 403 si el proyecto es anónimo (sin dueño)', async () => {
    prisma.guide.findUnique.mockResolvedValue({ id: dto.guideId });
    prisma.project.findUnique.mockResolvedValue({
      id: dto.projectId,
      userId: null,
    });

    await expect(service.create(dto, 'student-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  describe('findAll', () => {
    it('el alumno lista solo sus entregas', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.submission.count.mockResolvedValue(0);

      await service.findAll({ id: 'student-1', role: Role.STUDENT });

      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } }),
      );
    });

    it('el docente lista las entregas de sus guías', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.submission.count.mockResolvedValue(0);

      await service.findAll({ id: 'teacher-1', role: Role.TEACHER });

      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guide: { teacherId: 'teacher-1' } },
        }),
      );
    });

    it('incluye los datos públicos del alumno (sin passwordHash)', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.submission.count.mockResolvedValue(0);

      await service.findAll({ id: 'teacher-1', role: Role.TEACHER });

      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            student: { select: { id: true, name: true, email: true } },
          }),
        }),
      );
    });

    it('filtra por guideId dentro del alcance del rol y pagina', async () => {
      prisma.submission.findMany.mockResolvedValue([{ id: 's-1' }]);
      prisma.submission.count.mockResolvedValue(1);

      const result = await service.findAll(
        { id: 'teacher-1', role: Role.TEACHER },
        { guideId: dto.guideId, take: 10, skip: 5 },
      );

      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            guide: { teacherId: 'teacher-1' },
            guideId: dto.guideId,
          },
          take: 10,
          skip: 5,
        }),
      );
      expect(result).toEqual({ items: [{ id: 's-1' }], total: 1 });
    });
  });

  describe('findOne', () => {
    const submission = {
      id: 's-1',
      guideId: dto.guideId,
      studentId: 'student-1',
      guide: { id: dto.guideId, title: 'Guía', teacherId: 'teacher-1' },
    };

    it('la ve el alumno que entregó', async () => {
      prisma.submission.findUnique.mockResolvedValue(submission);

      const result = await service.findOne('s-1', 'student-1');

      expect(result.id).toBe('s-1');
    });

    it('la ve el docente de la guía', async () => {
      prisma.submission.findUnique.mockResolvedValue(submission);

      const result = await service.findOne('s-1', 'teacher-1');

      expect(result.id).toBe('s-1');
    });

    it('lanza 404 para un tercero (no filtra su existencia)', async () => {
      prisma.submission.findUnique.mockResolvedValue(submission);

      await expect(service.findOne('s-1', 'otro-alumno')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza 404 si la entrega no existe', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(service.findOne('faltante', 'student-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('reemplaza el proyecto de una entrega propia', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's-1',
        studentId: 'student-1',
      });
      prisma.project.findUnique.mockResolvedValue({
        id: dto.projectId,
        userId: 'student-1',
      });
      prisma.submission.update.mockResolvedValue({ id: 's-1' });

      await service.update('s-1', { projectId: dto.projectId }, 'student-1');

      expect(prisma.submission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-1' },
          data: { projectId: dto.projectId },
        }),
      );
    });

    it('lanza 403 si la entrega pertenece a otro alumno', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's-1',
        studentId: 'otro-alumno',
      });

      await expect(
        service.update('s-1', { projectId: dto.projectId }, 'student-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.submission.update).not.toHaveBeenCalled();
    });

    it('lanza 404 si la entrega no existe', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(
        service.update('faltante', { projectId: dto.projectId }, 'student-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si el proyecto nuevo no existe', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's-1',
        studentId: 'student-1',
      });
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.update('s-1', { projectId: dto.projectId }, 'student-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.submission.update).not.toHaveBeenCalled();
    });

    it('lanza 403 si el proyecto nuevo es ajeno', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's-1',
        studentId: 'student-1',
      });
      prisma.project.findUnique.mockResolvedValue({
        id: dto.projectId,
        userId: 'otro-alumno',
      });

      await expect(
        service.update('s-1', { projectId: dto.projectId }, 'student-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.submission.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina una entrega propia', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's-1',
        studentId: 'student-1',
      });
      prisma.submission.delete.mockResolvedValue({ id: 's-1' });

      const result = await service.remove('s-1', 'student-1');

      expect(result).toEqual({ message: 'Entrega eliminada', id: 's-1' });
      expect(prisma.submission.delete).toHaveBeenCalledWith({
        where: { id: 's-1' },
      });
    });

    it('lanza 403 si la entrega pertenece a otro alumno', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's-1',
        studentId: 'otro-alumno',
      });

      await expect(service.remove('s-1', 'student-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.submission.delete).not.toHaveBeenCalled();
    });

    it('lanza 404 si la entrega no existe', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(service.remove('faltante', 'student-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
