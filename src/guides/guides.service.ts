import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';
import { UpdateGuideDto } from './dto/update-guide.dto.js';
import { ListGuidesQueryDto } from './dto/list-guides-query.dto.js';

/** Nombre y título del docente y del proyecto plantilla, sin exponer más datos */
const GUIDE_INCLUDE = {
  teacher: { select: { id: true, name: true } },
  starterProject: { select: { id: true, title: true, shareSlug: true } },
} satisfies Prisma.GuideInclude;

@Injectable()
export class GuidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGuideDto, teacherId: string) {
    await this.assertStarterProjectExists(dto.starterProjectId);

    return this.prisma.guide.create({
      data: {
        title: dto.title,
        instructions: dto.instructions,
        starterProjectId: dto.starterProjectId,
        teacherId,
      },
      include: GUIDE_INCLUDE,
    });
  }

  findAll(query: ListGuidesQueryDto = {}) {
    return this.prisma.guide.findMany({
      where: query.teacherId ? { teacherId: query.teacherId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: GUIDE_INCLUDE,
    });
  }

  async findOne(id: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id },
      include: GUIDE_INCLUDE,
    });

    if (!guide) {
      throw new NotFoundException(`No existe la guía "${id}"`);
    }

    return guide;
  }

  /** Solo el docente dueño de la guía puede editarla */
  async update(id: string, dto: UpdateGuideDto, teacherId: string) {
    await this.assertOwnership(id, teacherId);

    if (dto.starterProjectId !== undefined) {
      await this.assertStarterProjectExists(dto.starterProjectId);
    }

    const data: Prisma.GuideUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.instructions !== undefined) data.instructions = dto.instructions;
    if (dto.starterProjectId !== undefined) {
      data.starterProject = { connect: { id: dto.starterProjectId } };
    }

    return this.prisma.guide.update({
      where: { id },
      data,
      include: GUIDE_INCLUDE,
    });
  }

  /** Solo el docente dueño de la guía puede eliminarla (borra sus entregas en cascada) */
  async remove(id: string, teacherId: string) {
    await this.assertOwnership(id, teacherId);
    await this.prisma.guide.delete({ where: { id } });

    return { message: 'Guía eliminada', id };
  }

  private async assertOwnership(id: string, teacherId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });

    if (!guide) {
      throw new NotFoundException(`No existe la guía "${id}"`);
    }

    if (guide.teacherId !== teacherId) {
      throw new ForbiddenException('No tenés permiso sobre esta guía');
    }

    return guide;
  }

  private async assertStarterProjectExists(starterProjectId: string) {
    const starterProject = await this.prisma.project.findUnique({
      where: { id: starterProjectId },
      select: { id: true },
    });

    if (!starterProject) {
      throw new NotFoundException(
        `No existe el proyecto plantilla "${starterProjectId}"`,
      );
    }
  }
}
