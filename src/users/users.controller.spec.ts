import 'reflect-metadata';
import { Role } from '@prisma/client';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

describe('UsersController', () => {
  let controller: UsersController;
  let service: { updateRole: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = { updateRole: vi.fn() };
    controller = new UsersController(service as unknown as UsersService);
  });

  describe('PATCH /users/:id/role', () => {
    it('exige JWT y rol ADMIN', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        controller.updateRole,
      ) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, controller.updateRole)).toEqual([
        Role.ADMIN,
      ]);
    });

    it('delega la promoción con el id del admin autenticado', async () => {
      const req = {
        user: { id: 'admin-1', email: 'admin@test.com', role: Role.ADMIN },
      };
      const updated = {
        id: 'user-1',
        email: 'alumno@test.com',
        name: 'Alumno',
        role: Role.TEACHER,
      };
      service.updateRole.mockResolvedValue(updated);

      const result = await controller.updateRole(
        'user-1',
        { role: Role.TEACHER },
        req as never,
      );

      expect(result).toEqual(updated);
      expect(service.updateRole).toHaveBeenCalledWith('user-1', {
        role: Role.TEACHER,
      }, 'admin-1');
    });
  });
});
