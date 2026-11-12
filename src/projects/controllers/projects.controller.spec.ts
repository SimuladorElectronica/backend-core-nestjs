import 'reflect-metadata';
import {
  ProjectsDeleteController,
  ProjectsReadController,
  ProjectsTemplateController,
  ProjectsWriteController,
} from './projects.controller.js';
import { ProjectsService } from '../services/projects.service.js';
import { ProjectTemplatesService } from '../services/project-templates.service.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../guards/optional-jwt-auth.guard.js';

const GUARDS_METADATA = '__guards__';

describe('ProjectsController', () => {
  let read: ProjectsReadController;
  let write: ProjectsWriteController;
  let template: ProjectsTemplateController;
  let removeProject: ProjectsDeleteController;
  let service: {
    list: ReturnType<typeof vi.fn>;
    findByKey: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let templates: {
    listTemplates: ReturnType<typeof vi.fn>;
    findTemplateBySlug: ReturnType<typeof vi.fn>;
    setTemplate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn(),
      findByKey: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    templates = {
      listTemplates: vi.fn(),
      findTemplateBySlug: vi.fn(),
      setTemplate: vi.fn(),
    };
    read = new ProjectsReadController(
      service as unknown as ProjectsService,
      templates as unknown as ProjectTemplatesService,
    );
    write = new ProjectsWriteController(
      service as unknown as ProjectsService,
    );
    template = new ProjectsTemplateController(
      templates as unknown as ProjectTemplatesService,
    );
    removeProject = new ProjectsDeleteController(
      service as unknown as ProjectsService,
    );
  });

  describe('GET /projects', () => {
    it('es público opcional y expone el total en X-Total-Count', async () => {
      const res = { setHeader: vi.fn() };
      service.list.mockResolvedValue({ items: [{ id: 'p-1' }], total: 33 });

      const items = await read.list(null, { take: 5 }, res as never);

      expect(service.list).toHaveBeenCalledWith(null, { take: 5 });
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 33);
      expect(items).toEqual([{ id: 'p-1' }]);

      const guards = Reflect.getMetadata(GUARDS_METADATA, read.list) as unknown[];
      expect(guards).toContain(OptionalJwtAuthGuard);
    });

    it('pasa el id del usuario cuando hay sesión', async () => {
      const res = { setHeader: vi.fn() };
      service.list.mockResolvedValue({ items: [], total: 0 });

      await read.list({ id: 'user-1' }, {}, res as never);

      expect(service.list).toHaveBeenCalledWith('user-1', {});
    });
  });

  describe('GET /projects/:key', () => {
    it('es público opcional y delega en findByKey', async () => {
      service.findByKey.mockResolvedValue({ id: 'p-1' });

      const result = await read.findOne('a9f3b2', null);

      expect(result).toEqual({ id: 'p-1' });
      expect(service.findByKey).toHaveBeenCalledWith('a9f3b2', null);

      const guards = Reflect.getMetadata(GUARDS_METADATA, read.findOne) as unknown[];
      expect(guards).toContain(OptionalJwtAuthGuard);
    });

    it('delega con el id autenticado cuando hay sesión', async () => {
      service.findByKey.mockResolvedValue({ id: 'p-1' });

      await read.findOne('3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d', { id: 'user-1' });

      expect(service.findByKey).toHaveBeenCalledWith(
        '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
        'user-1',
      );
    });
  });

  describe('POST /projects', () => {
    it('es público opcional y permite usuario anónimo', async () => {
      service.create.mockResolvedValue({ id: 'p-1', shareUrl: 'http://x' });
      const dto = { code: 'void setup() {}', circuitData: {} };

      await write.create(dto, null);

      expect(service.create).toHaveBeenCalledWith(dto, null);
    });

    it('pasa el id del usuario cuando hay sesión', async () => {
      service.create.mockResolvedValue({ id: 'p-1' });
      const dto = { code: 'void setup() {}', circuitData: {} };

      await write.create(dto, { id: 'user-1' });

      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('PUT /projects/:id', () => {
    it('exige JWT y delega con el id del token', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, write.update) as unknown[];
      expect(guards).toContain(JwtAuthGuard);
    });

    it('delega la edición con el id autenticado', async () => {
      service.update.mockResolvedValue({ id: 'p-1' });

      await write.update('3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d', { title: 'Nuevo' }, {
        id: 'user-1',
      });

      expect(service.update).toHaveBeenCalledWith(
        '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
        { title: 'Nuevo' },
        'user-1',
      );
    });
  });

  describe('DELETE /projects/:id', () => {
    it('exige JWT y delega la eliminación con el id autenticado', async () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        removeProject.remove,
      ) as unknown[];
      expect(guards).toContain(JwtAuthGuard);

      service.remove.mockResolvedValue({ message: 'x', id: 'p-1' });

      await removeProject.remove('3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d', {
        id: 'user-1',
      });

      expect(service.remove).toHaveBeenCalledWith(
        '3f1c8f9e-2a41-4f6b-9d5e-7c2b1a0f4e8d',
        'user-1',
      );
    });
  });

  describe('plantillas', () => {
    it('GET /projects/templates delega en el servicio de plantillas', async () => {
      templates.listTemplates.mockResolvedValue([{ slug: 'abc123' }]);

      await expect(read.listTemplates()).resolves.toEqual([{ slug: 'abc123' }]);
      expect(templates.listTemplates).toHaveBeenCalled();
    });

    it('GET /projects/templates/:slug delega con el slug', async () => {
      templates.findTemplateBySlug.mockResolvedValue({ slug: 'abc123' });

      await read.findTemplate('abc123');

      expect(templates.findTemplateBySlug).toHaveBeenCalledWith('abc123');
    });

    it('PATCH /projects/:id/template delega en el servicio de plantillas', async () => {
      templates.setTemplate.mockResolvedValue({ id: 'p-1' });
      const requester = { id: 'user-1', role: 'TEACHER' as never };

      await template.setTemplate('p-1', { isTemplate: true }, requester);

      expect(templates.setTemplate).toHaveBeenCalledWith('p-1', true, requester);
    });
  });
});
