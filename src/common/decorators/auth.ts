import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';

type RoleName = 'admin' | 'teacher' | 'student';

/** auth requerido: guards + bearer en swagger; rol opcional */
export const auth = (role?: RoleName, summary?: string) =>
  applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth('bearer'),
    ...(summary ? [ApiOperation({ summary })] : []),
    ...(role ? [Roles(role.toUpperCase() as Role)] : []),
  );

/** auth opcional: el endpoint funciona con o sin token */
export const optionalAuth = (summary?: string) =>
  applyDecorators(
    UseGuards(OptionalJwtAuthGuard),
    ApiBearerAuth('bearer'),
    ...(summary ? [ApiOperation({ summary })] : []),
  );

/** documenta un endpoint público y nada más */
export const info = (summary: string) =>
  applyDecorators(ApiOperation({ summary }));
