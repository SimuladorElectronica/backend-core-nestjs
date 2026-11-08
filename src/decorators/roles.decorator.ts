import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Declara los roles permitidos para un endpoint.
 * Ej: @Roles(Role.TEACHER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
