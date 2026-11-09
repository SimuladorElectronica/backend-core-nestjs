import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
    };
  };

  beforeEach(() => {
    prisma = {
      guide: { findUnique: vi.fn() },
      project: { findUnique: vi.fn() },
      submission: { create: vi.fn() },
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
});
