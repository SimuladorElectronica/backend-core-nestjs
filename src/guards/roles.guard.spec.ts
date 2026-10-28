import 'reflect-metadata';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard.js';
import { Roles, ROLES_KEY } from '../decorators/roles.decorator.js';

describe('RolesGuard', () => {
  const handler = () => undefined;
  class Target {}

  const buildContext = (user?: { role: Role }) =>
    ({
      getHandler: () => handler,
      getClass: () => Target,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  const buildGuard = (roles: Role[] | undefined) => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(roles),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('permite el paso cuando el endpoint no declara roles', () => {
    const guard = buildGuard(undefined);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('permite el paso a un usuario con rol TEACHER', () => {
    const guard = buildGuard([Role.TEACHER]);

    expect(guard.canActivate(buildContext({ role: Role.TEACHER }))).toBe(true);
  });

  it('lanza 403 a un usuario con rol STUDENT', () => {
    const guard = buildGuard([Role.TEACHER]);

    expect(() =>
      guard.canActivate(buildContext({ role: Role.STUDENT })),
    ).toThrow(ForbiddenException);
  });

  it('lanza 403 si no hay usuario autenticado', () => {
    const guard = buildGuard([Role.TEACHER]);

    expect(() => guard.canActivate(buildContext())).toThrow(ForbiddenException);
  });

  it('el decorador @Roles aplica la metadata con la clave esperada', () => {
    const decorator = Roles(Role.TEACHER);
    const target = () => undefined;

    decorator(target);

    expect(ROLES_KEY).toBe('roles');
    expect(Reflect.getMetadata(ROLES_KEY, target)).toEqual([Role.TEACHER]);
  });
});
