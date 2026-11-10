import 'reflect-metadata';
import { Role } from '@prisma/client';
import { LibrariesController } from './libraries.controller.js';
import { LibrariesService } from './libraries.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

describe('LibrariesController', () => {
  let controller: LibrariesController;

  beforeEach(() => {
    controller = new LibrariesController(
      {} as LibrariesService,
    );
  });

  it('POST exige JWT y rol ADMIN (TEACHER recibe 403)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.create,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toEqual([
      Role.ADMIN,
    ]);
  });

  it('PUT exige JWT y rol ADMIN', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.update,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, controller.update)).toEqual([
      Role.ADMIN,
    ]);
  });

  it('DELETE exige JWT y rol ADMIN', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.remove,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, controller.remove)).toEqual([
      Role.ADMIN,
    ]);
  });

  it('GET /libraries y GET /libraries/:id son públicos (sin roles)', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, controller.findAll),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, controller.findOne),
    ).toBeUndefined();
  });
});
