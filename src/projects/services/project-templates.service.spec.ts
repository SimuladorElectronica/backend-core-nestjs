import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ProjectTemplatesService } from './project-templates.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('ProjectTemplatesService', () => {
  let service: ProjectTemplatesService;
  let prisma: {
    project: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      project: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new ProjectTemplatesService(prisma as unknown as PrismaService);
  });

  describe('listTemplates', () => {
    it('expone shareSlug como slug y no filtra datos del dueño', async () => {
      prisma.project.findMany.mockResolvedValue([
        { id: 'p-1', shareSlug: 'a9f3b2', title: 'Plantilla' },
      ]);

      const result = await service.listTemplates();

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isTemplate: true } }),
      );
      expect(result).toEqual([
        { id: 'p-1', title: 'Plantilla', slug: 'a9f3b2' },
      ]);
      expect(result[0]).not.toHaveProperty('shareSlug');
    });
  });

  describe('findTemplateBySlug', () => {
    it('busca solo entre plantillas y expone slug', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 'p-1',
        shareSlug: 'a9f3b2',
        title: 'Plantilla',
      });

      const result = await service.findTemplateBySlug('a9f3b2');

      expect(prisma.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shareSlug: 'a9f3b2', isTemplate: true },
        }),
      );
      expect(result).toEqual({
        id: 'p-1',
        title: 'Plantilla',
        slug: 'a9f3b2',
      });
    });

    it('lanza 404 si no existe la plantilla', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findTemplateBySlug('zzzzzz')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setTemplate', () => {
    const updated = {
      id: 'p-1',
      shareSlug: 'a9f3b2',
      title: 'Plantilla',
      isTemplate: true,
    };

    it('permite al ADMIN marcar cualquier proyecto', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p-1', userId: 'otro' });
      prisma.project.update.mockResolvedValue(updated);

      const result = await service.setTemplate('p-1', true, {
        id: 'admin-1',
        role: Role.ADMIN,
      });

      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p-1' }, data: { isTemplate: true } }),
      );
      expect(result.shareUrl).toContain('a9f3b2');
    });

    it('permite al TEACHER dueño marcar su proyecto', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'teacher-1',
      });
      prisma.project.update.mockResolvedValue(updated);

      await service.setTemplate('p-1', false, {
        id: 'teacher-1',
        role: Role.TEACHER,
      });

      expect(prisma.project.update).toHaveBeenCalled();
    });

    it('rechaza al TEACHER que no es dueño', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'teacher-1',
      });

      await expect(
        service.setTemplate('p-1', true, {
          id: 'teacher-2',
          role: Role.TEACHER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza al TEACHER cuando el proyecto es anónimo', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: null,
      });

      await expect(
        service.setTemplate('p-1', true, {
          id: 'teacher-1',
          role: Role.TEACHER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza a un STUDENT', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'student-1',
      });

      await expect(
        service.setTemplate('p-1', true, {
          id: 'student-1',
          role: Role.STUDENT,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza 404 si el proyecto no existe', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.setTemplate('p-1', true, {
          id: 'admin-1',
          role: Role.ADMIN,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
