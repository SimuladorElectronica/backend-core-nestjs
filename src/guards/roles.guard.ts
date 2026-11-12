import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { rolesKey } from '../decorators/roles.decorator.js';
import { forbidden } from '../common/errors.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(rolesKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    // si el endpoint no declara roles, no restringe nada
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw forbidden('no tenés permiso para realizar esta acción');
    }

    return true;
  }
}
