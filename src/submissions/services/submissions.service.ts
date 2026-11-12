import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notFound, forbidden } from '../../common/errors.js';
import { CreateSubmissionDto } from '../dto/create-submission.dto.js';
import { UpdateSubmissionDto } from '../dto/update-submission.dto.js';
import { ListSubmissionsQueryDto } from '../dto/list-submissions-query.dto.js';
import { resolvePagination } from '../../common/dto/pagination-query.dto.js';

type submissionWhereInput = Prisma.SubmissionWhereInput;

const submissionInclude = {
  guide: { select: { id: true, title: true } },
  project: { select: { id: true, title: true, shareSlug: true } },
  // datos públicos del alumno que entregó (nunca el passwordHash)
  student: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SubmissionInclude;

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubmissionDto, studentId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: dto.guideId },
      select: { id: true, classroomId: true },
    });

    if (!guide) {
      throw notFound(`no existe la guía "${dto.guideId}"`);
    }

    await this.assertEnrolled(guide.classroomId, studentId);
    await this.assertProjectBelongsTo(dto.projectId, studentId);

    return this.prisma.submission.create({
      data: {
        guideId: dto.guideId,
        studentId,
        projectId: dto.projectId,
      },
      include: submissionInclude,
    });
  }

  /**
   * listado paginado por rol: el docente ve las entregas de sus guías,
   * el alumno ve solo las suyas y el admin, todas. `guideId` filtra dentro de ese alcance
   */
  async findAll(
    user: { id: string; role: Role },
    query: ListSubmissionsQueryDto = {},
  ) {
    const where: submissionWhereInput =
      user.role === Role.ADMIN
        ? {}
        : user.role === Role.TEACHER
          ? { guide: { teacherId: user.id } }
          : { studentId: user.id };

    if (query.guideId) {
      where.guideId = query.guideId;
    }

    const { take, skip } = resolvePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take,
        skip,
        include: submissionInclude,
      }),
      this.prisma.submission.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * detalle: visible para el alumno que entregó, para el docente
   * de la guía (recepción de soluciones) y para el admin. para terceros: 404
   */
  async findOne(id: string, requester: { id: string; role: Role }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        ...submissionInclude,
        guide: { select: { id: true, title: true, teacherId: true } },
      },
    });

    if (!submission) {
      throw notFound(`no existe la entrega "${id}"`);
    }

    const isOwner = submission.studentId === requester.id;
    const isGuideTeacher = submission.guide.teacherId === requester.id;
    const isAdmin = requester.role === Role.ADMIN;

    if (!isOwner && !isGuideTeacher && !isAdmin) {
      throw notFound(`no existe la entrega "${id}"`);
    }

    return submission;
  }

  /** solo el alumno dueño inscripto en el aula puede reemplazar el proyecto entregado */
  async update(id: string, dto: UpdateSubmissionDto, requesterId: string) {
    const submission = await this.assertOwnership(id, requesterId);
    await this.assertEnrolled(submission.guide.classroomId, requesterId);
    await this.assertProjectBelongsTo(dto.projectId, requesterId);

    return this.prisma.submission.update({
      where: { id },
      data: { projectId: dto.projectId },
      include: submissionInclude,
    });
  }

  /** solo el alumno dueño puede retirar su entrega */
  async remove(id: string, requesterId: string) {
    await this.assertOwnership(id, requesterId);
    await this.prisma.submission.delete({ where: { id } });

    return { message: 'entrega eliminada', id };
  }

  private async assertOwnership(id: string, requesterId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        guide: { select: { classroomId: true } },
      },
    });

    if (!submission) {
      throw notFound(`no existe la entrega "${id}"`);
    }

    if (submission.studentId !== requesterId) {
      throw forbidden('no tenés permiso sobre esta entrega');
    }

    return submission;
  }

  private async assertEnrolled(classroomId: string, studentId: string) {
    const membership = await this.prisma.classroomStudent.findUnique({
      where: { classroomId_studentId: { classroomId, studentId } },
    });

    if (!membership) {
      throw forbidden('no estás inscripto en el aula de esta guía');
    }
  }

  private async assertProjectBelongsTo(projectId: string, requesterId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    });

    if (!project) {
      throw notFound(`no existe el proyecto "${projectId}"`);
    }

    // solo proyectos propios: los anónimos (userId null) y ajenos se rechazan
    if (project.userId !== requesterId) {
      throw forbidden(
        'el proyecto no te pertenece: solo podés entregar proyectos propios',
      );
    }
  }
}
