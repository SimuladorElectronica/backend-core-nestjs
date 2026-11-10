import 'reflect-metadata';
import { Role } from '@prisma/client';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

const ADMIN = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin',
  role: Role.ADMIN,
};

describe('UsersController', () => {
  let controller: UsersController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    updateRole: ReturnType<typeof vi.fn>;
    updateMe: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      updateRole: vi.fn(),
      updateMe: vi.fn(),
      changePassword: vi.fn(),
      deactivate: vi.fn(),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  const guardsOf = (handler: unknown): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, handler as never) as unknown[];

  describe('GET /users', () => {
    it('exige JWT y rol ADMIN', () => {
      const guards = guardsOf(controller.findAll);

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, controller.findAll)).toEqual([
        Role.ADMIN,
      ]);
    });

    it('devuelve los items y expone el total en X-Total-Count', async () => {
      const items = [{ id: 'u-1' }];
      const res = { setHeader: vi.fn() };
      service.findAll.mockResolvedValue({ items, total: 7 });

      const result = await controller.findAll(
        { role: Role.STUDENT },
        res as never,
      );

      expect(result).toEqual(items);
      expect(service.findAll).toHaveBeenCalledWith({ role: Role.STUDENT });
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 7);
    });
  });

  describe('GET /users/:id', () => {
    it('exige JWT y rol ADMIN y delega la búsqueda', async () => {
      const guards = guardsOf(controller.findOne);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, controller.findOne)).toEqual([
        Role.ADMIN,
      ]);

      service.findOne.mockResolvedValue({ id: 'u-1' });

      await expect(controller.findOne('u-1')).resolves.toEqual({ id: 'u-1' });
      expect(service.findOne).toHaveBeenCalledWith('u-1');
    });
  });

  describe('PATCH /users/me', () => {
    it('exige JWT sin restricción de rol y usa el id del token', async () => {
      expect(guardsOf(controller.updateMe)).toContain(JwtAuthGuard);
      expect(
        Reflect.getMetadata(ROLES_KEY, controller.updateMe),
      ).toBeUndefined();

      service.updateMe.mockResolvedValue({ id: 'admin-1' });

      await controller.updateMe({ name: 'Nuevo' }, { user: ADMIN } as never);

      expect(service.updateMe).toHaveBeenCalledWith('admin-1', {
        name: 'Nuevo',
      });
    });
  });

  describe('PATCH /users/me/password', () => {
    it('exige JWT y delega con el id del token', async () => {
      expect(guardsOf(controller.changePassword)).toContain(JwtAuthGuard);
      expect(
        Reflect.getMetadata(ROLES_KEY, controller.changePassword),
      ).toBeUndefined();

      service.changePassword.mockResolvedValue({
        message: 'Contraseña actualizada',
      });

      await controller.changePassword(
        { currentPassword: 'Vieja123!', newPassword: 'Nueva123!' },
        { user: ADMIN } as never,
      );

      expect(service.changePassword).toHaveBeenCalledWith('admin-1', {
        currentPassword: 'Vieja123!',
        newPassword: 'Nueva123!',
      });
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('exige JWT y rol ADMIN', () => {
      const guards = guardsOf(controller.updateRole);

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, controller.updateRole)).toEqual([
        Role.ADMIN,
      ]);
    });

    it('delega la promoción con el id del admin autenticado', async () => {
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
        { user: ADMIN } as never,
      );

      expect(result).toEqual(updated);
      expect(service.updateRole).toHaveBeenCalledWith(
        'user-1',
        { role: Role.TEACHER },
        'admin-1',
      );
    });
  });

  describe('DELETE /users/:id', () => {
    it('exige JWT y rol ADMIN y delega con el id del admin', async () => {
      const guards = guardsOf(controller.deactivate);

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, controller.deactivate)).toEqual([
        Role.ADMIN,
      ]);

      service.deactivate.mockResolvedValue({
        message: 'Usuario desactivado',
        id: 'user-1',
      });

      await controller.deactivate('user-1', { user: ADMIN } as never);

      expect(service.deactivate).toHaveBeenCalledWith('user-1', 'admin-1');
    });
  });
});
