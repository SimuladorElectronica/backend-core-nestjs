import { Prisma } from '@prisma/client';

const matches = (code: string) => (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === code;

/** helpers para mapear errores de prisma a 4xx sin tipar en cada servicio */
export const isUniqueViolation = matches('P2002');
export const isForeignKeyViolation = matches('P2003');
