import { Prisma } from '@prisma/client';

/** docente del aula (id, nombre) y contadores; el `code` se expone aparte */
export const classroomInclude = {
  teacher: { select: { id: true, name: true } },
  _count: { select: { students: true, guides: true } },
} satisfies Prisma.ClassroomInclude;

export type classroomWithMeta = Prisma.ClassroomGetPayload<{
  include: typeof classroomInclude;
}>;
