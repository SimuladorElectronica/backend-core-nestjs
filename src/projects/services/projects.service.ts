import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateShareSlug } from '../../common/utils/share-slug.js';
import { defined } from '../../common/utils/defined.js';
import {
  notFound,
  forbidden,
  conflict,
  internalError,
} from '../../common/errors.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/prisma-errors.js';
import { CreateProjectDto } from '../dto/create-project.dto.js';
import { UpdateProjectDto } from '../dto/update-project.dto.js';
import {
  PaginationQueryDto,
  resolvePagination,
} from '../../common/dto/pagination-query.dto.js';
import {
  projectDetailSelect,
  projectShareSelect,
  projectSummarySelect,
} from '../project-selects.js';
import { buildShareUrl } from '../utils/share-url.js';

type projectWhereInput = Prisma.ProjectWhereInput;
type projectCreateData = Omit<Prisma.ProjectUncheckedCreateInput, 'shareSlug'>;

/** intentos ante la colisión de shareSlug por el índice único */
const maxSlugAttempts = 5;

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
    const project = await createWithUniqueSlug(
      this.prisma,
      buildCreateData(dto, userId),
    );

    return { ...project, shareUrl: buildShareUrl(project.shareSlug) };
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

  /** detalle por id (uuid); el detalle privado solo lo ve su dueño */
  async getById(id: string, requesterId: string | null) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: projectDetailSelect,
    });

    assertProjectVisible(project, id, requesterId);

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
    await assertProjectOwnership(this.prisma, id, requesterId);

    const updated = await this.prisma.project.update({
      where: { id },
      data: buildUpdateData(dto),
      select: projectDetailSelect,
    });

    return { ...updated, shareUrl: buildShareUrl(updated.shareSlug) };
  }

  async remove(id: string, requesterId: string) {
    await assertProjectOwnership(this.prisma, id, requesterId);

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
}

function buildCreateData(
  dto: CreateProjectDto,
  userId: string | null,
): projectCreateData {
  return {
    title: dto.title ?? 'circuito sin título',
    description: dto.description,
    circuitData: dto.circuitData as Prisma.InputJsonValue,
    code: dto.code,
    isPublic: dto.isPublic ?? true,
    userId,
  };
}

function buildUpdateData(dto: UpdateProjectDto): Prisma.ProjectUpdateInput {
  return defined({
    title: dto.title,
    description: dto.description,
    circuitData: dto.circuitData as Prisma.InputJsonValue,
    code: dto.code,
    isPublic: dto.isPublic,
  }) as Prisma.ProjectUpdateInput;
}

async function createWithUniqueSlug(
  prisma: PrismaService,
  data: projectCreateData,
) {
  try {
    return await attemptCreate(prisma, data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw internalError('no se pudo generar un shareSlug único');
    }
    throw error;
  }
}

async function attemptCreate(
  prisma: PrismaService,
  data: projectCreateData,
  attemptsLeft = maxSlugAttempts,
) {
  try {
    return await prisma.project.create({
      data: { ...data, shareSlug: generateShareSlug() },
    });
  } catch (error) {
    if (!isUniqueViolation(error) || attemptsLeft <= 1) {
      throw error;
    }
    return attemptCreate(prisma, data, attemptsLeft - 1);
  }
}

function assertProjectVisible(
  project: { isPublic: boolean; userId: string | null } | null,
  id: string,
  requesterId: string | null,
) {
  if (!project) {
    throw notFound(`no existe el proyecto "${id}"`);
  }

  if (project.isPublic) {
    return;
  }

  if (requesterId !== null && project.userId === requesterId) {
    return;
  }

  throw notFound(`no existe el proyecto "${id}"`);
}

async function assertProjectOwnership(
  prisma: PrismaService,
  id: string,
  requesterId: string,
) {
  const project = await prisma.project.findUnique({
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
