import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { forbidden, notFound } from '../../common/errors.js';
import { ListGuidesQueryDto } from '../dto/list-guides-query.dto.js';

type requester = { id: string; role: Role };
type guideRef = { teacherId: string; classroomId: string };
type guideWhere = Prisma.GuideWhereInput;

const isAdmin = (user: requester) => user.role === Role.ADMIN;
const isTeacher = (user: requester) => user.role === Role.TEACHER;
const isStudent = (user: requester) => user.role === Role.STUDENT;

const canViewDirectly = (guide: guideRef, user: requester) =>
  isAdmin(user) || guide.teacherId === user.id;

@Injectable()
export class GuideAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * filtro del listado según rol: el docente ve las guías de las aulas que creó;
   * el alumno, las de las aulas en las que está inscripto; el admin, todas.
   * `teacherId` y `classroomId` filtran dentro de ese alcance.
   */
  listWhereFor(
    user: requester,
    query: ListGuidesQueryDto = {},
  ): guideWhere {
    const where: guideWhere = isAdmin(user)
      ? {}
      : isTeacher(user)
        ? { classroom: { teacherId: user.id } }
        : { classroom: { students: { some: { studentId: user.id } } } };

    if (query.teacherId) {
      where.teacherId = query.teacherId;
    }

    if (query.classroomId) {
      where.classroomId = query.classroomId;
    }

    return where;
  }

  /** solo el docente dueño de la guía puede editarla o eliminarla */
  async assertOwnership(id: string, teacherId: string) {
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

  async assertStarterProjectExists(starterProjectId: string) {
    const starterProject = await this.prisma.project.findUnique({
      where: { id: starterProjectId },
      select: { id: true },
    });

    if (!starterProject) {
      throw notFound(`no existe el proyecto plantilla "${starterProjectId}"`);
    }
  }

  async assertClassroomOwnedBy(classroomId: string, teacherId: string) {
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

  /**
   * detalle: visible para el admin, para el docente dueño de la guía y para los
   * alumnos inscriptos en el aula de la guía. para el resto: 404.
   */
  async assertVisible(guide: guideRef | null, id: string, user: requester) {
    if (!guide) {
      throw notFound(`no existe la guía "${id}"`);
    }

    if (canViewDirectly(guide, user)) {
      return;
    }

    if (!isStudent(user) || !(await this.isMember(guide.classroomId, user.id))) {
      throw notFound(`no existe la guía "${id}"`);
    }
  }

  private async isMember(classroomId: string, studentId: string) {
    const membership = await this.prisma.classroomStudent.findUnique({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
    });

    return membership !== null;
  }
}
