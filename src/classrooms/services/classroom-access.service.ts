import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { forbidden, notFound } from '../../common/errors.js';
import { classroomInclude, type classroomWithMeta } from '../classroom-selects.js';

type requester = {
  id: string;
  role: Role;
};

type classroomWhere = Prisma.ClassroomWhereInput;

const isAdmin = (user: requester) => user.role === Role.ADMIN;
const isTeacher = (user: requester) => user.role === Role.TEACHER;
const isStudent = (user: requester) => user.role === Role.STUDENT;

/** filtro del listado según el rol del usuario */
export function listWhereFor(user: requester): classroomWhere {
  if (isAdmin(user)) {
    return {};
  }

  if (isTeacher(user)) {
    return { teacherId: user.id };
  }

  return { students: { some: { studentId: user.id } } };
}

/** el `code` solo viaja a docentes y admin */
export function canSeeCode(user: requester) {
  return !isStudent(user);
}

/** dueño del aula o admin */
export function canManage(teacherId: string, user: requester) {
  return teacherId === user.id || isAdmin(user);
}

function assertFound<T extends { id: string }>(
  classroom: T | null,
  id: string,
): asserts classroom is T {
  if (!classroom) {
    throw notFound(`no existe el aula "${id}"`);
  }
}

function assertManage(teacherId: string, user: requester) {
  if (!canManage(teacherId, user)) {
    throw forbidden('no tenés permiso sobre esta aula');
  }
}

@Injectable()
export class ClassroomAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** detalle visible para el docente dueño, los inscriptos y el admin */
  async findVisible(id: string, user: requester): Promise<classroomWithMeta> {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: classroomInclude,
    });

    if (!classroom) {
      throw notFound(`no existe el aula "${id}"`);
    }

    if (canManage(classroom.teacherId, user)) {
      return classroom;
    }

    if (isStudent(user) && (await this.isMember(id, user.id))) {
      return classroom;
    }

    throw notFound(`no existe el aula "${id}"`);
  }

  /** aula con sus alumnos; solo el docente dueño o el admin */
  async findWithStudents(id: string, user: requester) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        students: {
          orderBy: { joinedAt: 'asc' },
          select: {
            joinedAt: true,
            student: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    assertFound(classroom, id);
    assertManage(classroom.teacherId, user);

    return classroom;
  }

  /** aula con el conteo de guías, para bloquear el borrado */
  async findWithGuideCount(id: string, user: requester) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: { _count: { select: { guides: true } } },
    });

    assertFound(classroom, id);
    assertManage(classroom.teacherId, user);

    return classroom;
  }

  /** aula mínima para operar sobre el código de unión */
  async assertOwnership(id: string, user: requester) {
    const classroom = await this.findOrFail(id);
    assertManage(classroom.teacherId, user);

    return classroom;
  }

  /**
   * permiso para quitar a un alumno: el docente dueño o el admin pueden quitar
   * a cualquiera; un alumno solo puede quitarse a sí mismo ("dejar el aula").
   */
  async assertCanRemoveMember(
    id: string,
    studentId: string,
    user: requester,
  ) {
    const classroom = await this.findOrFail(id);
    const isOwner = canManage(classroom.teacherId, user);
    const isSelf = user.id === studentId;

    if (!isOwner && !isSelf) {
      throw forbidden('no tenés permiso sobre esta aula');
    }

    return { isOwner, isSelf };
  }

  async assertMember(id: string, studentId: string) {
    const membership = await this.prisma.classroomStudent.findUnique({
      where: {
        classroomId_studentId: { classroomId: id, studentId },
      },
    });

    if (!membership) {
      throw notFound('el alumno no está inscripto en el aula');
    }
  }

  private async findOrFail(id: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });

    assertFound(classroom, id);

    return classroom;
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
