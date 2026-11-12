import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notFound, conflict } from '../../common/errors.js';
import { CreateClassroomDto } from '../dto/create-classroom.dto.js';
import { classroomInclude, type classroomWithMeta } from '../classroom-selects.js';
import { withUniqueCode } from '../utils/unique-code.js';
import {
  ClassroomAccessService,
  canManage,
  canSeeCode,
  listWhereFor,
} from './classroom-access.service.js';

type requester = {
  id: string;
  role: Role;
};

@Injectable()
export class ClassroomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassroomAccessService,
  ) {}

  async create(dto: CreateClassroomDto, teacherId: string) {
    const classroom = await withUniqueCode((code) =>
      this.prisma.classroom.create({
        data: { name: dto.name, code, teacherId },
        include: classroomInclude,
      }),
    );

    return toResponse(classroom, true);
  }

  /**
   * listado según rol: el docente ve las aulas que creó; el alumno, las que cursa;
   * el admin, todas. el `code` solo viaja a docentes (propias) y admin.
   */
  async findAll(user: requester) {
    const classrooms = await this.prisma.classroom.findMany({
      where: listWhereFor(user),
      orderBy: { createdAt: 'desc' },
      include: classroomInclude,
    });

    const includeCode = canSeeCode(user);
    return classrooms.map((classroom) => toResponse(classroom, includeCode));
  }

  /**
   * detalle: visible para el docente dueño, los alumnos inscriptos y el admin;
   * para el resto, 404 (no filtra la existencia). el `code` solo lo ven dueño y admin.
   */
  async findOne(id: string, user: requester) {
    const classroom = await this.access.findVisible(id, user);
    const includeCode = canManage(classroom.teacherId, user);

    return toResponse(classroom, includeCode);
  }

  /** alumnos inscriptos: solo el docente dueño o el admin */
  async listStudents(id: string, user: requester) {
    const classroom = await this.access.findWithStudents(id, user);

    return classroom.students.map(({ student, joinedAt }) => ({
      ...student,
      joinedAt,
    }));
  }

  /** inscripción por código: solo alumnos (el controller lo limita a rol student) */
  async join(code: string, studentId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { code },
      include: classroomInclude,
    });

    if (!classroom) {
      throw notFound('no existe un aula con ese código');
    }

    const existing = await this.prisma.classroomStudent.findUnique({
      where: {
        classroomId_studentId: { classroomId: classroom.id, studentId },
      },
    });

    if (existing) {
      throw conflict('ya estás inscripto en el aula');
    }

    await this.prisma.classroomStudent.create({
      data: { classroomId: classroom.id, studentId },
    });

    const fresh = await this.prisma.classroom.findUniqueOrThrow({
      where: { id: classroom.id },
      include: classroomInclude,
    });

    return toResponse(fresh, false);
  }

  /**
   * quita a un alumno del aula: el docente dueño o el admin pueden quitar a cualquiera;
   * un alumno solo puede quitarse a sí mismo ("dejar el aula").
   */
  async removeMember(id: string, studentId: string, user: requester) {
    const { isOwner, isSelf } = await this.access.assertCanRemoveMember(
      id,
      studentId,
      user,
    );

    await this.access.assertMember(id, studentId);

    await this.prisma.classroomStudent.delete({
      where: {
        classroomId_studentId: { classroomId: id, studentId },
      },
    });

    return {
      message:
        isSelf && !isOwner ? 'te retiraste del aula' : 'alumno removido del aula',
      classroomId: id,
      studentId,
    };
  }

  /** regenera el código de unión (el anterior queda invalidado). dueño o admin. */
  async regenerateCode(id: string, user: requester) {
    await this.access.assertOwnership(id, user);

    const updated = await withUniqueCode((code) =>
      this.prisma.classroom.update({ where: { id }, data: { code } }),
    );

    return { id: updated.id, code: updated.code };
  }

  /** elimina el aula. si tiene guías retorna 409 (eliminarlas primero). inscripciones en cascada. */
  async remove(id: string, user: requester) {
    const classroom = await this.access.findWithGuideCount(id, user);

    if (classroom._count.guides > 0) {
      throw conflict('el aula tiene guías vinculadas: eliminalas primero');
    }

    await this.prisma.classroom.delete({ where: { id } });

    return { message: 'aula eliminada', id };
  }
}

function toResponse(classroom: classroomWithMeta, includeCode: boolean) {
  const { teacher, _count, ...rest } = classroom;

  return {
    id: rest.id,
    name: rest.name,
    createdAt: rest.createdAt,
    teacher,
    memberCount: _count.students,
    guideCount: _count.guides,
    ...(includeCode ? { code: rest.code } : {}),
  };
}
