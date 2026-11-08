import { NotFoundException } from '@nestjs/common';
import { GuidesService } from './guides.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';

const dto: CreateGuideDto = {
  title: 'Práctica 1 - LED parpadeante',
  instructions: 'Conectá un LED al pin 13 y hacélo parpadear cada segundo.',
  starterProjectId: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
};

describe('GuidesService', () => {
  let service: GuidesService;
  let prisma: {
    guide: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    project: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      guide: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      project: {
        findUnique: vi.fn(),
      },
    };
    service = new GuidesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('crea una guía vinculada al docente y al proyecto plantilla', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: dto.starterProjectId });
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
  });

  describe('findAll', () => {
    it('lista guías ordenadas de más reciente a más antigua', async () => {
      prisma.guide.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.guide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findOne', () => {
    it('retorna la guía con docente y proyecto plantilla', async () => {
      const guide = { id: 'g-1', title: dto.title };
      prisma.guide.findUnique.mockResolvedValue(guide);

      const result = await service.findOne('g-1');

      expect(result).toEqual(guide);
      expect(prisma.guide.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'g-1' } }),
      );
    });

    it('lanza 404 si la guía no existe', async () => {
      prisma.guide.findUnique.mockResolvedValue(null);

      await expect(service.findOne('faltante')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
