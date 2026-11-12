import 'reflect-metadata';
import { Role } from '@prisma/client';
import { GuidesController } from './guides.controller.js';
import { GuidesService } from './guides.service.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { rolesKey } from '../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

const dto: CreateGuideDto = {
  title: 'Práctica 1 - LED parpadeante',
  instructions: 'Conectá un LED al pin 13 y hacélo parpadear cada segundo.',
  starterProjectId: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
};

describe('GuidesController', () => {
  let controller: GuidesController;
  let service: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    controller = new GuidesController(service as unknown as GuidesService);
  });

  describe('POST /guides', () => {
    it('exige JWT y rol TEACHER en el endpoint de creación', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        controller.create,
      ) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      // RolesGuard (roles.guard.spec) lanza 403 ante un STUDENT
      expect(Reflect.getMetadata(rolesKey, controller.create)).toEqual([
        Role.TEACHER,
      ]);
    });

    it('delega la creación con el id del docente autenticado', async () => {
      const req = {
        user: { id: 'teacher-1', email: 'profe@test.com', role: Role.TEACHER },
      };
      service.create.mockResolvedValue({ id: 'g-1' });

      const result = await controller.create(
        dto,
        req as never,
      );

      expect(result).toEqual({ id: 'g-1' });
      expect(service.create).toHaveBeenCalledWith(dto, 'teacher-1');
    });
  });

  describe('GET /guides', () => {
    it('el listado no declara roles (lectura sin restricción de rol)', () => {
      expect(
        Reflect.getMetadata(rolesKey, controller.findAll),
      ).toBeUndefined();
    });

    it('delega el listado al servicio', async () => {
      const guides = [{ id: 'g-1' }];
      service.findAll.mockResolvedValue(guides);

      await expect(controller.findAll({})).resolves.toEqual(guides);
      expect(service.findAll).toHaveBeenCalledWith({});
    });

    it('delega el filtro por docente', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll({ teacherId: 'teacher-1' });

      expect(service.findAll).toHaveBeenCalledWith({ teacherId: 'teacher-1' });
    });
  });

  describe('GET /guides/:id', () => {
    it('delega la búsqueda por UUID al servicio', async () => {
      const guide = { id: 'g-1' };
      service.findOne.mockResolvedValue(guide);

      await expect(controller.findOne('g-1')).resolves.toEqual(guide);
      expect(service.findOne).toHaveBeenCalledWith('g-1');
    });
  });

  describe('PUT /guides/:id', () => {
    it('exige JWT y rol TEACHER, además del chequeo de ownership en el servicio', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.update) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, controller.update)).toEqual([
        Role.TEACHER,
      ]);
    });

    it('delega la edición con el id del docente autenticado', async () => {
      const req = {
        user: { id: 'teacher-1', email: 'profe@test.com', role: Role.TEACHER },
      };
      service.update.mockResolvedValue({ id: 'g-1', title: 'Editada' });

      const result = await controller.update(
        'g-1',
        { title: 'Editada' },
        req as never,
      );

      expect(result).toEqual({ id: 'g-1', title: 'Editada' });
      expect(service.update).toHaveBeenCalledWith(
        'g-1',
        { title: 'Editada' },
        'teacher-1',
      );
    });
  });

  describe('DELETE /guides/:id', () => {
    it('exige JWT y rol TEACHER, además del chequeo de ownership en el servicio', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.remove) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, controller.remove)).toEqual([
        Role.TEACHER,
      ]);
    });

    it('delega la eliminación con el id del docente autenticado', async () => {
      const req = {
        user: { id: 'teacher-1', email: 'profe@test.com', role: Role.TEACHER },
      };
      service.remove.mockResolvedValue({ message: 'Guía eliminada', id: 'g-1' });

      const result = await controller.remove('g-1', req as never);

      expect(result).toEqual({ message: 'Guía eliminada', id: 'g-1' });
      expect(service.remove).toHaveBeenCalledWith('g-1', 'teacher-1');
    });
  });
});
