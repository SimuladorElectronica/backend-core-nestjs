import 'reflect-metadata';
import { Role } from '@prisma/client';
import {
  GuidesReadController,
  GuidesWriteController,
} from './guides.controller.js';
import { GuidesService } from '../services/guides.service.js';
import { CreateGuideDto } from '../dto/create-guide.dto.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { rolesKey } from '../../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

const dto: CreateGuideDto = {
  title: 'prÃƒÂ¡ctica 1 - led parpadeante',
  instructions: 'conectÃƒÂ¡ un led al pin 13 y hacÃƒÂ©lo parpadear cada segundo.',
  starterProjectId: '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
  classroomId: '8c1f4a2e-6b3d-4e8f-a1c7-9d0e2f3b5a61',
};

const teacher = { id: 'teacher-1', email: 'profe@test.com', role: Role.TEACHER };

describe('GuidesController', () => {
  let read: GuidesReadController;
  let write: GuidesWriteController;
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
    read = new GuidesReadController(service as unknown as GuidesService);
    write = new GuidesWriteController(service as unknown as GuidesService);
  });

  describe('POST /guides', () => {
    it('exige jwt y rol TEACHER en el endpoint de creaciÃƒÂ³n', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        write.create,
      ) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, write.create)).toEqual([
        Role.TEACHER,
      ]);
    });

    it('delega la creaciÃƒÂ³n con el id del docente autenticado', async () => {
      service.create.mockResolvedValue({ id: 'g-1' });

      const result = await write.create(dto, teacher);

      expect(result).toEqual({ id: 'g-1' });
      expect(service.create).toHaveBeenCalledWith(dto, 'teacher-1');
    });
  });

  describe('GET /guides', () => {
    it('el listado no declara roles (lectura sin restricciÃƒÂ³n de rol)', () => {
      expect(Reflect.getMetadata(rolesKey, read.findAll)).toBeUndefined();
    });

    it('delega el listado al servicio', async () => {
      const guides = [{ id: 'g-1' }];
      service.findAll.mockResolvedValue(guides);

      await expect(read.findAll({}, teacher)).resolves.toEqual(guides);
      expect(service.findAll).toHaveBeenCalledWith({}, teacher);
    });

    it('delega el filtro por docente', async () => {
      service.findAll.mockResolvedValue([]);

      await read.findAll({ teacherId: 'teacher-1' }, teacher);

      expect(service.findAll).toHaveBeenCalledWith({ teacherId: 'teacher-1' }, teacher);
    });
  });

  describe('GET /guides/:id', () => {
    it('delega la bÃƒÂºsqueda por uuid al servicio', async () => {
      const guide = { id: 'g-1' };
      service.findOne.mockResolvedValue(guide);

      await expect(read.findOne('g-1', teacher)).resolves.toEqual(guide);
      expect(service.findOne).toHaveBeenCalledWith('g-1', teacher);
    });
  });

  describe('PUT /guides/:id', () => {
    it('exige jwt y rol TEACHER, ademÃƒÂ¡s del chequeo de ownership del servicio', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, write.update) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, write.update)).toEqual([
        Role.TEACHER,
      ]);
    });

    it('delega la ediciÃƒÂ³n con el id del docente autenticado', async () => {
      service.update.mockResolvedValue({ id: 'g-1', title: 'Editada' });

      const result = await write.update('g-1', { title: 'Editada' }, teacher);

      expect(result).toEqual({ id: 'g-1', title: 'Editada' });
      expect(service.update).toHaveBeenCalledWith(
        'g-1',
        { title: 'Editada' },
        'teacher-1',
      );
    });
  });

  describe('DELETE /guides/:id', () => {
    it('exige jwt y rol TEACHER, ademÃƒÂ¡s del chequeo de ownership del servicio', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, write.remove) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(rolesKey, write.remove)).toEqual([
        Role.TEACHER,
      ]);
    });

    it('delega la eliminaciÃƒÂ³n con el id del docente autenticado', async () => {
      service.remove.mockResolvedValue({ message: 'guÃƒÂ­a eliminada', id: 'g-1' });

      const result = await write.remove('g-1', teacher);

      expect(result).toEqual({ message: 'guÃƒÂ­a eliminada', id: 'g-1' });
      expect(service.remove).toHaveBeenCalledWith('g-1', 'teacher-1');
    });
  });
});
