import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateShareSlug } from '../common/utils/share-slug.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

/** Intentos ante la (improbable) colisión de shareSlug por el índice único */
const MAX_SLUG_ATTEMPTS = 5;
const LIST_LIMIT = 20;

const PROJECT_SUMMARY_SELECT = {
  id: true,
  shareSlug: true,
  title: true,
  description: true,
  isPublic: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

const PROJECT_DETAIL_SELECT = {
  ...PROJECT_SUMMARY_SELECT,
  circuitData: true,
  code: true,
} satisfies Prisma.ProjectSelect;

/** Vista pública del enlace compartido: nunca expone el userId */
const PROJECT_SHARE_SELECT = {
  id: true,
  shareSlug: true,
  title: true,
  description: true,
  circuitData: true,
  code: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHARE_SLUG_REGEX = /^[a-z0-9]{6}$/;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Guardado anónimo (userId null) o autenticado.
   * Genera un shareSlug de 6 caracteres con reintento ante colisión.
   */
  async create(dto: CreateProjectDto, userId: string | null) {
    let lastCollision: unknown = null;

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      try {
        const project = await this.prisma.project.create({
          data: {
            shareSlug: generateShareSlug(),
            title: dto.title ?? 'Circuito sin título',
            description: dto.description,
            circuitData: dto.circuitData as Prisma.InputJsonValue,
            code: dto.code,
            isPublic: dto.isPublic ?? true,
            userId,
          },
        });

        return { ...project, shareUrl: this.buildShareUrl(project.shareSlug) };
      } catch (error) {
        if (this.isUniqueViolation(error) && attempt < MAX_SLUG_ATTEMPTS) {
          lastCollision = error;
          continue;
        }
        throw error;
      }
    }

    throw new InternalServerErrorException(
      lastCollision
        ? 'No se pudo generar un shareSlug único'
        : 'No se pudo guardar el proyecto',
    );
  }

  /** Listado: propios si hay sesión, públicos recientes si es anónimo */
  async list(userId: string | null) {
    return this.prisma.project.findMany({
      where: userId ? { userId } : { isPublic: true },
      orderBy: { updatedAt: 'desc' },
      take: LIST_LIMIT,
      select: PROJECT_SUMMARY_SELECT,
    });
  }

  /** Consulta por shareSlug: retorna circuitData (JSONB) y el código C++ */
  async findBySlug(shareSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { shareSlug },
      select: PROJECT_SHARE_SELECT,
    });

    if (!project || !project.isPublic) {
      throw new NotFoundException(
        `No existe un proyecto público con el enlace "${shareSlug}"`,
      );
    }

    return project;
  }

  /** Detalle por UUID (el request privado solo lo ve su dueño) */
  async getById(id: string, requesterId: string | null) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: PROJECT_DETAIL_SELECT,
    });

    const isOwner = requesterId !== null && project?.userId === requesterId;

    if (!project || (!project.isPublic && !isOwner)) {
      throw new NotFoundException(`No existe el proyecto "${id}"`);
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, requesterId: string) {
    await this.assertOwnership(id, requesterId);

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.circuitData !== undefined) {
      data.circuitData = dto.circuitData as Prisma.InputJsonValue;
    }
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;

    const updated = await this.prisma.project.update({
      where: { id },
      data,
      select: PROJECT_DETAIL_SELECT,
    });

    return { ...updated, shareUrl: this.buildShareUrl(updated.shareSlug) };
  }

  async remove(id: string, requesterId: string) {
    await this.assertOwnership(id, requesterId);

    try {
      await this.prisma.project.delete({ where: { id } });
    } catch (error) {
      // Vinculado a guías/entregas (FK Restrict)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'El proyecto está vinculado a guías o entregas y no puede eliminarse',
        );
      }
      throw error;
    }

    return { message: 'Proyecto eliminado', id };
  }

  /** El shareSlug es el identificador público; el UUID privado requiere dueño */
  isShareSlug(key: string): boolean {
    return SHARE_SLUG_REGEX.test(key);
  }

  isUuid(key: string): boolean {
    return UUID_REGEX.test(key);
  }

  private async assertOwnership(id: string, requesterId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!project) {
      throw new NotFoundException(`No existe el proyecto "${id}"`);
    }

    if (project.userId === null) {
      throw new ForbiddenException(
        'Los proyectos anónimos son de solo lectura',
      );
    }

    if (project.userId !== requesterId) {
      throw new ForbiddenException('No tenés permiso sobre este proyecto');
    }

    return project;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private buildShareUrl(shareSlug: string): string {
    const baseUrl =
      process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';
    return `${baseUrl}/share/${shareSlug}`;
  }
}
