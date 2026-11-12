import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { forbidden, notFound } from '../../common/errors.js';
import {
  projectDetailSelect,
  projectTemplateDetailSelect,
  projectTemplateListSelect,
} from '../project-selects.js';
import { buildShareUrl } from '../utils/share-url.js';

type templateRequester = { id: string; role: Role };

@Injectable()
export class ProjectTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

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

    return templates.map(toTemplate);
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

    return toTemplate(template);
  }

  /** marca o desmarca un proyecto como plantilla: ADMIN o TEACHER dueño */
  async setTemplate(
    id: string,
    isTemplate: boolean,
    requester: templateRequester,
  ) {
    await assertTemplatePermission(this.prisma, id, requester);

    const updated = await this.prisma.project.update({
      where: { id },
      data: { isTemplate },
      select: projectDetailSelect,
    });

    return { ...updated, shareUrl: buildShareUrl(updated.shareSlug) };
  }

}

async function assertTemplatePermission(
  prisma: PrismaService,
  id: string,
  requester: templateRequester,
) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!project) {
    throw notFound(`no existe el proyecto "${id}"`);
  }

  if (!canManageTemplates(requester, project.userId)) {
    throw forbidden(
      'solo un administrador o el docente dueño puede marcar plantillas',
    );
  }

  return project;
}

/** expone el shareSlug como `slug` en las respuestas públicas de plantillas */
function toTemplate<T extends { shareSlug: string }>(project: T) {
  const { shareSlug, ...rest } = project;
  return { ...rest, slug: shareSlug };
}

function canManageTemplates(
  requester: templateRequester,
  ownerId: string | null,
): boolean {
  if (requester.role === Role.ADMIN) {
    return true;
  }

  return (
    requester.role === Role.TEACHER &&
    ownerId !== null &&
    ownerId === requester.id
  );
}
