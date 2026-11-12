import { Prisma } from '@prisma/client';

/** Campos mínimos de un proyecto en los listados. */
export const projectSummarySelect = {
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

/** Detalle privado/autenticado: agrega el circuito y el código C++. */
export const projectDetailSelect = {
  ...projectSummarySelect,
  circuitData: true,
  code: true,
} satisfies Prisma.ProjectSelect;

/** Vista pública del enlace compartido: nunca expone el userId. */
export const projectShareSelect = {
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

/** Vista pública de plantilla (listado): nunca expone datos del dueño. */
export const projectTemplateListSelect = {
  id: true,
  shareSlug: true,
  title: true,
  description: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

/** Vista pública de plantilla (detalle): incluye el circuito y el código C++. */
export const projectTemplateDetailSelect = {
  ...projectTemplateListSelect,
  circuitData: true,
  code: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect;
