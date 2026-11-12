import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { defined } from '../../common/utils/defined.js';
import { CreateGuideDto } from '../dto/create-guide.dto.js';
import { UpdateGuideDto } from '../dto/update-guide.dto.js';
import { ListGuidesQueryDto } from '../dto/list-guides-query.dto.js';
import { GuideAccessService } from './guide-access.service.js';

/** nombre y título del docente, del aula y del proyecto plantilla, sin exponer más datos */
const guideInclude = {
  teacher: { select: { id: true, name: true } },
  classroom: { select: { id: true, name: true } },
  starterProject: { select: { id: true, title: true, shareSlug: true } },
} satisfies Prisma.GuideInclude;

type requester = {
  id: string;
  role: Role;
};

@Injectable()
export class GuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GuideAccessService,
  ) {}

  async create(dto: CreateGuideDto, teacherId: string) {
    await this.access.assertStarterProjectExists(dto.starterProjectId);
    await this.access.assertClassroomOwnedBy(dto.classroomId, teacherId);

    return this.prisma.guide.create({
      data: {
        title: dto.title,
        instructions: dto.instructions,
        starterProjectId: dto.starterProjectId,
        classroomId: dto.classroomId,
        teacherId,
      },
      include: guideInclude,
    });
  }

  /**
   * listado según rol: el docente ve las guías de las aulas que creó; el alumno,
   * las de las aulas en las que está inscripto; el admin, todas. `teacherId` y
   * `classroomId` filtran dentro de ese alcance.
   */
  findAll(query: ListGuidesQueryDto = {}, user: requester) {
    return this.prisma.guide.findMany({
      where: this.access.listWhereFor(user, query),
      orderBy: { createdAt: 'desc' },
      include: guideInclude,
    });
  }

  /** detalle visible para admin, docente dueño y alumnos inscriptos en el aula */
  async findOne(id: string, user: requester) {
    const guide = await this.prisma.guide.findUnique({
      where: { id },
      include: guideInclude,
    });

    await this.access.assertVisible(guide, id, user);

    return guide;
  }

  /** solo el docente dueño de la guía puede editarla (y moverla a otro de sus aulas) */
  async update(id: string, dto: UpdateGuideDto, teacherId: string) {
    await this.access.assertOwnership(id, teacherId);

    if (dto.starterProjectId !== undefined) {
      await this.access.assertStarterProjectExists(dto.starterProjectId);
    }

    if (dto.classroomId !== undefined) {
      await this.access.assertClassroomOwnedBy(dto.classroomId, teacherId);
    }

    return this.prisma.guide.update({
      where: { id },
      data: buildGuideUpdateData(dto),
      include: guideInclude,
    });
  }

  /** solo el docente dueño de la guía puede eliminarla (borra sus entregas en cascada) */
  async remove(id: string, teacherId: string) {
    await this.access.assertOwnership(id, teacherId);
    await this.prisma.guide.delete({ where: { id } });

    return { message: 'guía eliminada', id };
  }
}

function buildGuideUpdateData(dto: UpdateGuideDto): Prisma.GuideUpdateInput {
  const data = defined({
    title: dto.title,
    instructions: dto.instructions,
  }) as Prisma.GuideUpdateInput;

  if (dto.starterProjectId !== undefined) {
    data.starterProject = { connect: { id: dto.starterProjectId } };
  }

  if (dto.classroomId !== undefined) {
    data.classroom = { connect: { id: dto.classroomId } };
  }

  return data;
}
