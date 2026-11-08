import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';

/** Nombre y título del docente y del proyecto plantilla, sin exponer más datos */
const GUIDE_INCLUDE = {
  teacher: { select: { id: true, name: true } },
  starterProject: { select: { id: true, title: true, shareSlug: true } },
} satisfies Prisma.GuideInclude;

@Injectable()
export class GuidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGuideDto, teacherId: string) {
    const starterProject = await this.prisma.project.findUnique({
      where: { id: dto.starterProjectId },
      select: { id: true },
    });

    if (!starterProject) {
      throw new NotFoundException(
        `No existe el proyecto plantilla "${dto.starterProjectId}"`,
      );
    }

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

  findAll() {
    return this.prisma.guide.findMany({
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
}
