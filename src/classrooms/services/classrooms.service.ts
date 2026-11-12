import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateShareSlug } from '../../common/utils/share-slug.js';
import { notFound, forbidden, conflict } from '../../common/errors.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { CreateClassroomDto } from '../dto/create-classroom.dto.js';

type classroomWhereInput = Prisma.ClassroomWhereInput;

/** docente del aula (id, nombre) y contadores; el `code` se expone aparte y solo a dueño/admin */
const classroomInclude = {
  teacher: { select: { id: true, name: true } },
  _count: { select: { students: true, guides: true } },
} satisfies Prisma.ClassroomInclude;

type classroomWithMeta = Prisma.ClassroomGetPayload<{
  include: typeof classroomInclude;
}>;

type requester = {
  id: string;
  role: Role;
};

@Injectable()
export class ClassroomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClassroomDto, teacherId: string) {
    const classroom = await this.withUniqueCode((code) =>
      this.prisma.classroom.create({
        data: { name: dto.name, code, teacherId },
        include: classroomInclude,
      }),
    );

    return this.toResponse(classroom, true);
  }

  /**
   * listado según rol: el docente ve las aulas que creó; el alumno, las que cursa;
   * el admin, todas. el `code` solo viaja a docentes (propias) y admin.
   */
  async findAll(user: requester) {
    const where: classroomWhereInput =
      user.role === Role.ADMIN
        ? {}
        : user.role === Role.TEACHER
          ? { teacherId: user.id }
          : { students: { some: { studentId: user.id } } };

    const classrooms = await this.prisma.classroom.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: classroomInclude,
    });

    const includeCode = user.role !== Role.STUDENT;
    return classrooms.map((classroom) =>
      this.toResponse(classroom, includeCode),
    );
  }

  /**
   * detalle: visible para el docente dueño, los alumnos inscriptos y el admin;
   * para el resto, 404 (no filtra la existencia). el `code` solo lo ven dueño y admin.
   */
  async findOne(id: string, user: requester) {
    const classroom = await this.findVisibleClassroom(id, user);
    const includeCode = user.role === Role.ADMIN || classroom.teacherId === user.id;

    return this.toResponse(classroom, includeCode);
  }

  /** alumnos inscriptos: solo el docente dueño o el admin */
  async listStudents(id: string, user: requester) {
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

    if (!classroom) {
      throw notFound(`no existe el aula "${id}"`);
    }

    if (classroom.teacherId !== user.id && user.role !== Role.ADMIN) {
      throw forbidden('no tenés permiso sobre esta aula');
    }

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
      where: { classroomId_studentId: { classroomId: classroom.id, studentId } },
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

    return this.toResponse(fresh, false);
  }

  /**
   * quita a un alumno del aula: el docente dueño o el admin pueden quitar a cualquiera;
   * un alumno solo puede quitarse a sí mismo ("dejar el aula").
   */
  async removeMember(id: string, studentId: string, user: requester) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });

    if (!classroom) {
      throw notFound(`no existe el aula "${id}"`);
    }

    const isOwner =
      classroom.teacherId === user.id || user.role === Role.ADMIN;
    const isSelf = user.id === studentId;

    if (!isOwner && !isSelf) {
      throw forbidden('no tenés permiso sobre esta aula');
    }

    const membership = await this.prisma.classroomStudent.findUnique({
      where: { classroomId_studentId: { classroomId: id, studentId } },
    });

    if (!membership) {
      throw notFound('el alumno no está inscripto en el aula');
    }

    await this.prisma.classroomStudent.delete({
      where: { classroomId_studentId: { classroomId: id, studentId } },
    });

    return {
      message: isSelf && !isOwner ? 'te retiraste del aula' : 'alumno removido del aula',
      classroomId: id,
      studentId,
    };
  }

  /** regenera el código de unión (el anterior queda invalidado). dueño o admin. */
  async regenerateCode(id: string, user: requester) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });

    if (!classroom) {
      throw notFound(`no existe el aula "${id}"`);
    }

    if (
      classroom.teacherId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw forbidden('no tenés permiso sobre esta aula');
    }

    const updated = await this.withUniqueCode((code) =>
      this.prisma.classroom.update({ where: { id }, data: { code } }),
    );

    return { id: updated.id, code: updated.code };
  }

  /** elimina el aula. si tiene guías retorna 409 (eliminarlas primero). inscripciones en cascada. */
  async remove(id: string, user: requester) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: { _count: { select: { guides: true } } },
    });

    if (!classroom) {
      throw notFound(`no existe el aula "${id}"`);
    }

    if (
      classroom.teacherId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw forbidden('no tenés permiso sobre esta aula');
    }

    if (classroom._count.guides > 0) {
      throw conflict(
        'el aula tiene guías vinculadas: eliminalas primero',
      );
    }

    await this.prisma.classroom.delete({ where: { id } });

    return { message: 'aula eliminada', id };
  }

  private async findVisibleClassroom(id: string, user: requester) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: classroomInclude,
    });

    if (!classroom) {
      throw notFound(`no existe el aula "${id}"`);
    }

    if (user.role === Role.ADMIN || classroom.teacherId === user.id) {
      return classroom;
    }

    if (user.role === Role.STUDENT) {
      const membership = await this.prisma.classroomStudent.findUnique({
        where: { classroomId_studentId: { classroomId: id, studentId: user.id } },
      });

      if (membership) {
        return classroom;
      }
    }

    throw notFound(`no existe el aula "${id}"`);
  }

  /** genera un `code` y reintenta ante colisión de unicidad (p2002) */
  private async withUniqueCode<T>(
    fn: (code: string) => Promise<T>,
    attempts = 5,
  ): Promise<T> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn(generateShareSlug(6));
      } catch (error) {
        const isCodeCollision = isUniqueViolation(error);

        if (!isCodeCollision || attempt === attempts) {
          throw error;
        }
      }
    }

    // inalcanzable: el loop siempre retorna o lanza
    throw conflict('no se pudo generar un código único para el aula');
  }

  private toResponse(classroom: classroomWithMeta, includeCode: boolean) {
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
}
