import 'reflect-metadata';
import { Role } from '@prisma/client';
import {
  UsersReadController,
  UsersWriteController,
} from './users.controller.js';
import { UsersService } from '../services/users.service.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { rolesKey } from '../../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

const ADMIN = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin',
  role: Role.ADMIN,
};

describe('UsersController', () => {
  let read: UsersReadController;
  let write: UsersWriteController;
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
    read = new UsersReadController(service as unknown as UsersService);
    write = new UsersWriteController(service as unknown as UsersService);
  });

  const guardsOf = (handler: unknown): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, handler as never) as unknown[];

  describe('GET /users', () => {
    it('exige JWT y rol ADMIN', () => {
      const guards = guardsOf(read.findAll);

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, read.findAll)).toEqual([
        Role.ADMIN,
      ]);
    });

    it('devuelve los items y expone el total en X-Total-Count', async () => {
      const items = [{ id: 'u-1' }];
      const res = { setHeader: vi.fn() };
      service.findAll.mockResolvedValue({ items, total: 7 });

      const result = await read.findAll(
        { role: Role.STUDENT },
        res as never,
      );

      expect(result).toEqual(items);
      expect(service.findAll).toHaveBeenCalledWith({ role: Role.STUDENT });
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 7);
    });
  });

  describe('GET /users/:id', () => {
    it('exige JWT y rol ADMIN y delega la bÃºsqueda', async () => {
      const guards = guardsOf(read.findOne);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, read.findOne)).toEqual([
        Role.ADMIN,
      ]);

      service.findOne.mockResolvedValue({ id: 'u-1' });

      await expect(read.findOne('u-1')).resolves.toEqual({ id: 'u-1' });
      expect(service.findOne).toHaveBeenCalledWith('u-1');
    });
  });

  describe('PATCH /users/me', () => {
    it('exige JWT sin restricciÃ³n de rol y usa el id del token', async () => {
      expect(guardsOf(write.updateMe)).toContain(JwtAuthGuard);
      expect(
        Reflect.getMetadata(rolesKey, write.updateMe),
      ).toBeUndefined();

      service.updateMe.mockResolvedValue({ id: 'admin-1' });

      await write.updateMe({ name: 'Nuevo' }, ADMIN);

      expect(service.updateMe).toHaveBeenCalledWith('admin-1', {
        name: 'Nuevo',
      });
    });
  });

  describe('PATCH /users/me/password', () => {
    it('exige JWT y delega con el id del token', async () => {
      expect(guardsOf(write.changePassword)).toContain(JwtAuthGuard);
      expect(
        Reflect.getMetadata(rolesKey, write.changePassword),
      ).toBeUndefined();

      service.changePassword.mockResolvedValue({
        message: 'ContraseÃ±a actualizada',
      });

      await write.changePassword(
        { currentPassword: 'Vieja123!', newPassword: 'Nueva123!' },
        ADMIN,
      );

      expect(service.changePassword).toHaveBeenCalledWith('admin-1', {
        currentPassword: 'Vieja123!',
        newPassword: 'Nueva123!',
      });
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('exige JWT y rol ADMIN', () => {
      const guards = guardsOf(write.updateRole);

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, write.updateRole)).toEqual([
        Role.ADMIN,
      ]);
    });

    it('delega la promociÃ³n con el id del admin autenticado', async () => {
      const updated = {
        id: 'user-1',
        email: 'alumno@test.com',
        name: 'Alumno',
        role: Role.TEACHER,
      };
      service.updateRole.mockResolvedValue(updated);

      const result = await write.updateRole(
        'user-1',
        { role: Role.TEACHER },
        ADMIN,
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
      const guards = guardsOf(write.deactivate);

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, write.deactivate)).toEqual([
        Role.ADMIN,
      ]);

      service.deactivate.mockResolvedValue({
        message: 'usuario desactivado',
        id: 'user-1',
      });

      await write.deactivate('user-1', ADMIN);

      expect(service.deactivate).toHaveBeenCalledWith('user-1', 'admin-1');
    });
  });
});
