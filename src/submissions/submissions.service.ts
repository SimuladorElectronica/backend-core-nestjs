import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { UpdateSubmissionDto } from './dto/update-submission.dto.js';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto.js';
import { resolvePagination } from '../common/dto/pagination-query.dto.js';

const SUBMISSION_INCLUDE = {
  guide: { select: { id: true, title: true } },
  project: { select: { id: true, title: true, shareSlug: true } },
  // Datos públicos del alumno que entregó (nunca el passwordHash)
  student: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SubmissionInclude;

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubmissionDto, studentId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: dto.guideId },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException(`No existe la guía "${dto.guideId}"`);
    }

    await this.assertProjectBelongsTo(dto.projectId, studentId);

    return this.prisma.submission.create({
      data: {
        guideId: dto.guideId,
        studentId,
        projectId: dto.projectId,
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  /**
   * Listado paginado por rol: el docente ve las entregas de sus guías,
   * el alumno ve solo las suyas. `guideId` filtra dentro de ese alcance.
   */
  async findAll(
    user: { id: string; role: Role },
    query: ListSubmissionsQueryDto = {},
  ) {
    const where: Prisma.SubmissionWhereInput =
      user.role === Role.TEACHER
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
        include: SUBMISSION_INCLUDE,
      }),
      this.prisma.submission.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Detalle: visible para el alumno que entregó y para el docente
   * de la guía (recepción de soluciones). Para terceros: 404.
   */
  async findOne(id: string, requesterId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        ...SUBMISSION_INCLUDE,
        guide: { select: { id: true, title: true, teacherId: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException(`No existe la entrega "${id}"`);
    }

    const isOwner = submission.studentId === requesterId;
    const isGuideTeacher = submission.guide.teacherId === requesterId;

    if (!isOwner && !isGuideTeacher) {
      throw new NotFoundException(`No existe la entrega "${id}"`);
    }

    return submission;
  }

  /** Solo el alumno dueño puede reemplazar el proyecto entregado */
  async update(id: string, dto: UpdateSubmissionDto, requesterId: string) {
    await this.assertOwnership(id, requesterId);
    await this.assertProjectBelongsTo(dto.projectId, requesterId);

    return this.prisma.submission.update({
      where: { id },
      data: { projectId: dto.projectId },
      include: SUBMISSION_INCLUDE,
    });
  }

  /** Solo el alumno dueño puede retirar su entrega */
  async remove(id: string, requesterId: string) {
    await this.assertOwnership(id, requesterId);
    await this.prisma.submission.delete({ where: { id } });

    return { message: 'Entrega eliminada', id };
  }

  private async assertOwnership(id: string, requesterId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: { id: true, studentId: true },
    });

    if (!submission) {
      throw new NotFoundException(`No existe la entrega "${id}"`);
    }

    if (submission.studentId !== requesterId) {
      throw new ForbiddenException('No tenés permiso sobre esta entrega');
    }

    return submission;
  }

  private async assertProjectBelongsTo(projectId: string, requesterId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    });

    if (!project) {
      throw new NotFoundException(`No existe el proyecto "${projectId}"`);
    }

    // Solo proyectos propios: los anónimos (userId null) y ajenos se rechazan
    if (project.userId !== requesterId) {
      throw new ForbiddenException(
        'El proyecto no te pertenece: solo podés entregar proyectos propios',
      );
    }
  }
}
