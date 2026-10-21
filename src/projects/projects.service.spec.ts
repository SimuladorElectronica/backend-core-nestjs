import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectsService } from './projects.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

const baseDto: CreateProjectDto = {
  title: 'Práctica 1',
  description: 'Divisor de tensión',
  circuitData: { components: [{ id: 'r1', type: 'resistor' }], wires: [] },
  code: 'void setup() {}',
};

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: {
    project: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      project: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new ProjectsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('genera un shareSlug de 6 caracteres y guarda con userId nulo (anónimo)', async () => {
      prisma.project.create.mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ id: 'p-1', ...data }),
      );

      const result = await service.create(baseDto, null);

      expect(result.shareSlug).toMatch(/^[a-z0-9]{6}$/);
      expect(result.shareSlug).toHaveLength(6);
      expect(result.shareUrl).toContain(result.shareSlug);
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: null,
            circuitData: baseDto.circuitData,
            code: baseDto.code,
          }),
        }),
      );
    });

    it('reintenta la generación del slug ante una colisión del índice único', async () => {
      prisma.project.create
        .mockRejectedValueOnce(uniqueViolation())
        .mockImplementationOnce(({ data }: { data: object }) =>
          Promise.resolve({ id: 'p-2', ...data }),
        );

      const result = await service.create(baseDto, 'user-1');

      expect(prisma.project.create).toHaveBeenCalledTimes(2);
      expect(result.shareSlug).toMatch(/^[a-z0-9]{6}$/);
    });

    it('propaga errores que no son de unicidad sin reintentar', async () => {
      prisma.project.create.mockRejectedValueOnce(new Error('db down'));

      await expect(service.create(baseDto, null)).rejects.toThrow('db down');
      expect(prisma.project.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findBySlug', () => {
    const sharedProject = {
      id: 'p-1',
      shareSlug: 'a9f3b2',
      title: 'Práctica 1',
      description: null,
      circuitData: { components: [], wires: [] },
      code: 'void setup() {}',
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('retorna circuitData (JSONB) y el código C++ del proyecto público', async () => {
      prisma.project.findUnique.mockResolvedValue(sharedProject);

      const result = await service.findBySlug('a9f3b2');

      expect(result.circuitData).toEqual(sharedProject.circuitData);
      expect(result.code).toBe(sharedProject.code);
      expect(prisma.project.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shareSlug: 'a9f3b2' } }),
      );
      // La vista compartida nunca expone el userId
      expect(result).not.toHaveProperty('userId');
    });

    it('lanza 404 si el shareSlug no existe', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('zzzzzz')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza 404 si el proyecto existe pero es privado', async () => {
      prisma.project.findUnique.mockResolvedValue({
        ...sharedProject,
        isPublic: false,
      });

      await expect(service.findBySlug('a9f3b2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('lista los proyectos propios cuando hay sesión', async () => {
      prisma.project.findMany.mockResolvedValue([]);

      await service.list('user-1');

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('lista proyectos públicos para usuarios anónimos', async () => {
      prisma.project.findMany.mockResolvedValue([]);

      await service.list(null);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: true } }),
      );
    });
  });

  describe('update', () => {
    it('rechaza la edición de un proyecto anónimo (sin dueño)', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: null,
      });

      await expect(
        service.update('p-1', { title: 'Nuevo' }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('rechaza la edición de un proyecto de otro usuario', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'otro-usuario',
      });

      await expect(
        service.update('p-1', { title: 'Nuevo' }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('actualiza solo los campos enviados', async () => {
      prisma.project.findUnique
        .mockResolvedValueOnce({ id: 'p-1', userId: 'user-1' })
        .mockResolvedValueOnce(undefined);
      prisma.project.update.mockResolvedValue({
        id: 'p-1',
        shareSlug: 'a9f3b2',
        title: 'Nuevo título',
        description: null,
        circuitData: {},
        code: 'void setup() {}',
        isPublic: true,
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update(
        'p-1',
        { title: 'Nuevo título' },
        'user-1',
      );

      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-1' },
          data: { title: 'Nuevo título' },
        }),
      );
      expect(result.shareUrl).toContain('a9f3b2');
    });
  });

  describe('remove', () => {
    it('elimina un proyecto propio', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
      });
      prisma.project.delete.mockResolvedValue({ id: 'p-1' });

      const result = await service.remove('p-1', 'user-1');

      expect(result.id).toBe('p-1');
      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: 'p-1' },
      });
    });

    it('retorna 409 si el proyecto está vinculado a guías o entregas', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
      });
      prisma.project.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.remove('p-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
