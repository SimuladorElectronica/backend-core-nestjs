import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const rolesKey = 'roles';

/** declara los roles permitidos para un endpoint */
export const Roles = (...roles: Role[]) => SetMetadata(rolesKey, roles);
