import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notFound, forbidden } from '../../common/errors.js';
import { CreateGuideDto } from '../dto/create-guide.dto.js';
import { UpdateGuideDto } from '../dto/update-guide.dto.js';
import { ListGuidesQueryDto } from '../dto/list-guides-query.dto.js';

type guideWhereInput = Prisma.GuideWhereInput;
type guideUpdateInput = Prisma.GuideUpdateInput;

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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGuideDto, teacherId: string) {
    await this.assertStarterProjectExists(dto.starterProjectId);
    await this.assertClassroomOwnedBy(dto.classroomId, teacherId);

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
    const where: guideWhereInput =
      user.role === Role.ADMIN
        ? {}
        : user.role === Role.TEACHER
          ? { classroom: { teacherId: user.id } }
          : { classroom: { students: { some: { studentId: user.id } } } };

    if (query.teacherId) {
      where.teacherId = query.teacherId;
    }

    if (query.classroomId) {
      where.classroomId = query.classroomId;
    }

    return this.prisma.guide.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: guideInclude,
    });
  }

  /**
   * detalle: visible para el admin, para el docente dueño de la guía y para los
   * alumnos inscriptos en el aula de la guía. para el resto: 404.
   */
  async findOne(id: string, user: requester) {
    const guide = await this.prisma.guide.findUnique({
      where: { id },
      include: guideInclude,
    });

    if (!guide) {
      throw notFound(`no existe la guía "${id}"`);
    }

    if (user.role !== Role.ADMIN && guide.teacherId !== user.id) {
      if (user.role !== Role.STUDENT) {
        throw notFound(`no existe la guía "${id}"`);
      }

      const membership = await this.prisma.classroomStudent.findUnique({
        where: {
          classroomId_studentId: { classroomId: guide.classroomId, studentId: user.id },
        },
      });

      if (!membership) {
        throw notFound(`no existe la guía "${id}"`);
      }
    }

    return guide;
  }

  /** solo el docente dueño de la guía puede editarla (y moverla a otro de sus aulas) */
  async update(id: string, dto: UpdateGuideDto, teacherId: string) {
    await this.assertOwnership(id, teacherId);

    if (dto.starterProjectId !== undefined) {
      await this.assertStarterProjectExists(dto.starterProjectId);
    }

    if (dto.classroomId !== undefined) {
      await this.assertClassroomOwnedBy(dto.classroomId, teacherId);
    }

    const data: guideUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.instructions !== undefined) data.instructions = dto.instructions;
    if (dto.starterProjectId !== undefined) {
      data.starterProject = { connect: { id: dto.starterProjectId } };
    }
    if (dto.classroomId !== undefined) {
      data.classroom = { connect: { id: dto.classroomId } };
    }

    return this.prisma.guide.update({
      where: { id },
      data,
      include: guideInclude,
    });
  }

  /** solo el docente dueño de la guía puede eliminarla (borra sus entregas en cascada) */
  async remove(id: string, teacherId: string) {
    await this.assertOwnership(id, teacherId);
    await this.prisma.guide.delete({ where: { id } });

    return { message: 'guía eliminada', id };
  }

  private async assertOwnership(id: string, teacherId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });

    if (!guide) {
      throw notFound(`no existe la guía "${id}"`);
    }

    if (guide.teacherId !== teacherId) {
      throw forbidden('no tenés permiso sobre esta guía');
    }

    return guide;
  }

  private async assertStarterProjectExists(starterProjectId: string) {
    const starterProject = await this.prisma.project.findUnique({
      where: { id: starterProjectId },
      select: { id: true },
    });

    if (!starterProject) {
      throw notFound(
        `no existe el proyecto plantilla "${starterProjectId}"`,
      );
    }
  }

  private async assertClassroomOwnedBy(classroomId: string, teacherId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { id: true, teacherId: true },
    });

    if (!classroom) {
      throw notFound(`no existe el aula "${classroomId}"`);
    }

    if (classroom.teacherId !== teacherId) {
      throw forbidden('el aula no te pertenece');
    }

    return classroom;
  }
}
