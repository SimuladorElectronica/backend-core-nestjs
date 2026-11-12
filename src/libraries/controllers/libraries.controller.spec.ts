import 'reflect-metadata';
import { Role } from '@prisma/client';
import {
  LibrariesReadController,
  LibrariesWriteController,
} from './libraries.controller.js';
import { LibrariesService } from '../services/libraries.service.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { rolesKey } from '../../decorators/roles.decorator.js';

/** Clave interna de NestJS para la metadata de @UseGuards */
const GUARDS_METADATA = '__guards__';

describe('LibrariesController', () => {
  let read: LibrariesReadController;
  let write: LibrariesWriteController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    read = new LibrariesReadController(service as unknown as LibrariesService);
    write = new LibrariesWriteController(service as unknown as LibrariesService);
  });

  it('POST exige jwt y rol ADMIN (TEACHER recibe 403)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      write.create,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(rolesKey, write.create)).toEqual([Role.ADMIN]);
  });

  it('PUT exige jwt y rol ADMIN', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      write.update,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(rolesKey, write.update)).toEqual([Role.ADMIN]);
  });

  it('DELETE exige jwt y rol ADMIN', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      write.remove,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(rolesKey, write.remove)).toEqual([Role.ADMIN]);
  });

  it('GET /libraries y GET /libraries/:id son pÃºblicos (sin roles)', () => {
    expect(Reflect.getMetadata(rolesKey, read.findAll)).toBeUndefined();
    expect(Reflect.getMetadata(rolesKey, read.findOne)).toBeUndefined();
  });

  it('GET /libraries expone el total en X-Total-Count y devuelve los items', async () => {
    const res = { setHeader: vi.fn() };
    service.findAll.mockResolvedValue({ items: [{ id: 'lib-1' }], total: 3 });

    const items = await read.findAll({}, res as never);

    expect(service.findAll).toHaveBeenCalledWith({});
    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 3);
    expect(items).toEqual([{ id: 'lib-1' }]);
  });

  it('GET /libraries/:id delega la búsqueda al servicio', async () => {
    service.findOne.mockResolvedValue({ id: 'lib-1' });

    await expect(read.findOne('lib-1')).resolves.toEqual({ id: 'lib-1' });
    expect(service.findOne).toHaveBeenCalledWith('lib-1');
  });

  it('POST delega la creación en el servicio', async () => {
    const dto = {
      name: 'liquidcrystal',
      headerFile: 'liquidcrystal.h',
      author: 'marcos',
      description: 'lcd',
      version: '1.0.0',
    };
    service.create.mockResolvedValue({ id: 'lib-1', ...dto });

    const result = await write.create(dto);

    expect(result).toMatchObject({ id: 'lib-1' });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('PUT delega la actualización con el uuid de la ruta', async () => {
    service.update.mockResolvedValue({ id: 'lib-1', version: '1.1.0' });

    await expect(write.update('lib-1', { version: '1.1.0' })).resolves.toEqual({
      id: 'lib-1',
      version: '1.1.0',
    });
    expect(service.update).toHaveBeenCalledWith('lib-1', { version: '1.1.0' });
  });

  it('DELETE delega la eliminación con el uuid de la ruta', async () => {
    service.remove.mockResolvedValue({ message: 'x', id: 'lib-1' });

    await write.remove('lib-1');

    expect(service.remove).toHaveBeenCalledWith('lib-1');
  });
});
