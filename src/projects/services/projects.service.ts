import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateShareSlug } from '../../common/utils/share-slug.js';
import { notFound, forbidden, conflict, internalError } from '../../common/errors.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/prisma-errors.js';
import { CreateProjectDto } from '../dto/create-project.dto.js';
import { UpdateProjectDto } from '../dto/update-project.dto.js';
import {
  PaginationQueryDto,
  resolvePagination,
} from '../../common/dto/pagination-query.dto.js';

type projectWhereInput = Prisma.ProjectWhereInput;
type projectUpdateInput = Prisma.ProjectUpdateInput;

/** intentos ante la colisión de shareSlug por el índice único */
const maxSlugAttempts = 5;

const projectSummarySelect = {
  id: true,
  shareSlug: true,
  title: true,
  description: true,
  isPublic: true,
  isTemplate: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

const projectDetailSelect = {
  ...projectSummarySelect,
  circuitData: true,
  code: true,
} satisfies Prisma.ProjectSelect;

/** vista pública del enlace compartido: nunca expone el userId */
const projectShareSelect = {
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

/** vista pública de plantilla (listado): nunca expone datos del dueño */
const projectTemplateListSelect = {
  id: true,
  shareSlug: true,
  title: true,
  description: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

/** vista pública de plantilla (detalle): incluye el circuito y el código C++ */
const projectTemplateDetailSelect = {
  ...projectTemplateListSelect,
  circuitData: true,
  code: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const shareSlugRegex = /^[a-z0-9]{6}$/;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * guardado anónimo (userId null) o autenticado.
   * genera un shareSlug de 6 caracteres con reintento ante colisión.
   */
  async create(dto: CreateProjectDto, userId: string | null) {
    let lastCollision: unknown = null;

    for (let attempt = 1; attempt <= maxSlugAttempts; attempt++) {
      try {
        const project = await this.prisma.project.create({
          data: {
            shareSlug: generateShareSlug(),
            title: dto.title ?? 'circuito sin título',
            description: dto.description,
            circuitData: dto.circuitData as Prisma.InputJsonValue,
            code: dto.code,
            isPublic: dto.isPublic ?? true,
            userId,
          },
        });

        return { ...project, shareUrl: this.buildShareUrl(project.shareSlug) };
      } catch (error) {
        if (isUniqueViolation(error) && attempt < maxSlugAttempts) {
          lastCollision = error;
          continue;
        }
        throw error;
      }
    }

    throw internalError(
      lastCollision
        ? 'no se pudo generar un shareSlug único'
        : 'no se pudo guardar el proyecto',
    );
  }

  /** listado paginado: propios si hay sesión, públicos recientes si es anónimo */
  async list(userId: string | null, query: PaginationQueryDto = {}) {
    const where: projectWhereInput = userId
      ? { userId }
      : { isPublic: true };

    const { take, skip } = resolvePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
        select: projectSummarySelect,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total };
  }

  /** consulta pública por shareSlug: retorna el jsonb y el código c++ */
  async findBySlug(shareSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { shareSlug },
      select: projectShareSelect,
    });

    if (!project || !project.isPublic) {
      throw notFound(`no existe un proyecto público con el enlace "${shareSlug}"`);
    }

    return project;
  }

  /**
   * listado público de plantillas para el simulador (sin sesión).
   * `slug` es el shareSlug del proyecto; el original nunca se modifica.
   */
  async listTemplates() {
    const templates = await this.prisma.project.findMany({
      where: { isTemplate: true },
      orderBy: { updatedAt: 'desc' },
      select: projectTemplateListSelect,
    });

    return templates.map((template) => this.toTemplate(template));
  }

  /**
   * detalle público de una plantilla por slug (shareSlug).
   * si no existe o no está marcada como plantilla: 404 (no se revela su existencia).
   */
  async findTemplateBySlug(slug: string) {
    const template = await this.prisma.project.findFirst({
      where: { shareSlug: slug, isTemplate: true },
      select: projectTemplateDetailSelect,
    });

    if (!template) {
      throw notFound(`no existe una plantilla con el enlace "${slug}"`);
    }

    return this.toTemplate(template);
  }

  /** marca o desmarca un proyecto como plantilla: ADMIN o TEACHER dueño */
  async setTemplate(
    id: string,
    isTemplate: boolean,
    requester: { id: string; role: Role },
  ) {
    await this.assertTemplatePermission(id, requester);

    const updated = await this.prisma.project.update({
      where: { id },
      data: { isTemplate },
      select: projectDetailSelect,
    });

    return { ...updated, shareUrl: this.buildShareUrl(updated.shareSlug) };
  }

  /** detalle por id (uuid); el detalle privado solo lo ve su dueño */
  async getById(id: string, requesterId: string | null) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: projectDetailSelect,
    });

    const isOwner = requesterId !== null && project?.userId === requesterId;

    if (!project || (!project.isPublic && !isOwner)) {
      throw notFound(`no existe el proyecto "${id}"`);
    }

    return project;
  }

  /** resuelve el identificador de la ruta (shareSlug o uuid) según corresponda */
  async findByKey(key: string, requesterId: string | null) {
    if (shareSlugRegex.test(key)) {
      return this.findBySlug(key);
    }

    if (uuidRegex.test(key)) {
      return this.getById(key, requesterId);
    }

    throw notFound(`no existe un proyecto con el identificador "${key}"`);
  }

  async update(id: string, dto: UpdateProjectDto, requesterId: string) {
    await this.assertOwnership(id, requesterId);

    const data: projectUpdateInput = {};
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
      select: projectDetailSelect,
    });

    return { ...updated, shareUrl: this.buildShareUrl(updated.shareSlug) };
  }

  async remove(id: string, requesterId: string) {
    await this.assertOwnership(id, requesterId);

    try {
      await this.prisma.project.delete({ where: { id } });
    } catch (error) {
      // vinculado a guías o entregas (fk restrict)
      if (isForeignKeyViolation(error)) {
        throw conflict(
          'el proyecto está vinculado a guías o entregas y no puede eliminarse',
        );
      }
      throw error;
    }

    return { message: 'proyecto eliminado', id };
  }

  private async assertTemplatePermission(
    id: string,
    requester: { id: string; role: Role },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!project) {
      throw notFound(`no existe el proyecto "${id}"`);
    }

    const isAdmin = requester.role === Role.ADMIN;
    const isOwnerTeacher =
      requester.role === Role.TEACHER &&
      project.userId !== null &&
      project.userId === requester.id;

    if (!isAdmin && !isOwnerTeacher) {
      throw forbidden(
        'solo un administrador o el docente dueño puede marcar plantillas',
      );
    }

    return project;
  }

  /** expone el shareSlug como `slug` en las respuestas públicas de plantillas */
  private toTemplate<T extends { shareSlug: string }>(project: T) {
    const { shareSlug, ...rest } = project;
    return { ...rest, slug: shareSlug };
  }

  private async assertOwnership(id: string, requesterId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!project) {
      throw notFound(`no existe el proyecto "${id}"`);
    }

    if (project.userId === null) {
      throw forbidden('los proyectos anónimos son de solo lectura');
    }

    if (project.userId !== requesterId) {
      throw forbidden('no tenés permiso sobre este proyecto');
    }

    return project;
  }

  private buildShareUrl(shareSlug: string): string {
    const baseUrl =
      process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';
    return `${baseUrl}/share/${shareSlug}`;
  }
}
