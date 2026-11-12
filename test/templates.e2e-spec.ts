import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Plantillas pÃºblicas del simulador (modo invitado):
 * - GET /projects/templates y GET /projects/templates/:slug sin token
 * - un proyecto no plantilla (aunque sea pÃºblico) retorna 404 en la ruta pÃºblica
 * - PATCH /projects/:id/template: solo ADMIN o TEACHER dueÃ±o (STUDENT: 403)
 * - las respuestas pÃºblicas nunca exponen datos del dueÃ±o (userId, email, etc.)
 */
describe('Project templates (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;

  let templateId: string;
  let templateSlug: string;
  let publicProjectId: string;
  let publicProjectSlug: string;
  let studentProjectId: string;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  const PASSWORD = 'Password123!';
  // slugs Ãºnicos por corrida para no chocar con datos previos
  const run = Date.now().toString(36).slice(-3);
  const slugFor = (prefix: string) => `${prefix}${run}`.slice(0, 6);

  const circuitData = {
    components: [
      { id: 'r1', type: 'resistor', x: 120, y: 80, value: 1000 },
      { id: 'v1', type: 'vcc', x: 40, y: 80, value: 5 },
    ],
    wires: [{ from: 'v1:+', to: 'r1:1' }],
  };
  const cppCode = 'void setup() { pinMode(13, OUTPUT); }';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
    });

    const admin = await prisma.user.create({
      data: {
        email: 'e2e-templates-admin@test.com',
        name: 'Admin Templates E2E',
        role: Role.ADMIN,
        passwordHash,
      },
    });
    const teacher = await prisma.user.create({
      data: {
        email: 'e2e-templates-teacher@test.com',
        name: 'Docente Templates E2E',
        role: Role.TEACHER,
        passwordHash,
      },
    });
    const otherTeacher = await prisma.user.create({
      data: {
        email: 'e2e-templates-teacher2@test.com',
        name: 'Otro Docente Templates E2E',
        role: Role.TEACHER,
        passwordHash,
      },
    });
    const student = await prisma.user.create({
      data: {
        email: 'e2e-templates-student@test.com',
        name: 'Alumno Templates E2E',
        role: Role.STUDENT,
        passwordHash,
      },
    });
    createdUserIds.push(
      admin.id,
      teacher.id,
      otherTeacher.id,
      student.id,
    );

    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(201)
        .then((res) => res.body.access_token as string);

    adminToken = await login(admin.email);
    teacherToken = await login(teacher.email);
    otherTeacherToken = await login(otherTeacher.email);
    studentToken = await login(student.email);

    const template = await prisma.project.create({
      data: {
        title: 'E2E Plantilla LED',
        description: 'Plantilla pÃºblica de prueba',
        circuitData,
        code: cppCode,
        isPublic: false,
        isTemplate: true,
        userId: teacher.id,
        shareSlug: slugFor('a1'),
      },
    });
    templateId = template.id;
    templateSlug = template.shareSlug;
    createdProjectIds.push(template.id);

    // proyecto pÃºblico normal: NO debe servirse por la ruta de plantillas
    const publicProject = await prisma.project.create({
      data: {
        title: 'E2E Proyecto pÃºblico normal',
        circuitData,
        code: cppCode,
        isPublic: true,
        isTemplate: false,
        userId: teacher.id,
        shareSlug: slugFor('b2'),
      },
    });
    publicProjectId = publicProject.id;
    publicProjectSlug = publicProject.shareSlug;
    createdProjectIds.push(publicProject.id);

    const studentProject = await prisma.project.create({
      data: {
        title: 'E2E Proyecto del alumno',
        circuitData,
        code: cppCode,
        isPublic: false,
        isTemplate: false,
        userId: student.id,
        shareSlug: slugFor('c3'),
      },
    });
    studentProjectId = studentProject.id;
    createdProjectIds.push(studentProject.id);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (app) {
      await app.close();
    }
  });

  describe('GET /projects/templates (pÃºblico)', () => {
    it('lista las plantillas sin token y sin datos del dueÃ±o', async () => {
      const res = await request(app.getHttpServer())
        .get('/projects/templates')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);

      const template = res.body.find(
        (item: { slug: string }) => item.slug === templateSlug,
      );
      expect(template).toBeDefined();
      expect(template.id).toBe(templateId);
      expect(template.title).toBe('E2E Plantilla LED');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('updatedAt');

      // campos internos/del dueÃ±o fuera de la vista pÃºblica
      for (const item of res.body) {
        expect(item).not.toHaveProperty('userId');
        expect(item).not.toHaveProperty('user');
        expect(item).not.toHaveProperty('email');
        expect(item).not.toHaveProperty('shareSlug');
      }

      // el proyecto pÃºblico no plantilla no aparece en el listado
      expect(
        res.body.some(
          (item: { slug: string }) => item.slug === publicProjectSlug,
        ),
      ).toBe(false);
    });

    it('el listado no modifica el proyecto original', async () => {
      const before = await prisma.project.findUnique({
        where: { id: templateId },
      });

      await request(app.getHttpServer())
        .get('/projects/templates')
        .expect(200);

      const after = await prisma.project.findUnique({
        where: { id: templateId },
      });

      expect(after?.updatedAt).toEqual(before?.updatedAt);
      expect(after?.circuitData).toEqual(before?.circuitData);
    });
  });

  describe('GET /projects/templates/:slug (pÃºblico)', () => {
    it('retorna el proyecto completo sin token y sin datos del dueÃ±o', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/templates/${templateSlug}`)
        .expect(200);

      expect(res.body.id).toBe(templateId);
      expect(res.body.slug).toBe(templateSlug);
      expect(res.body.title).toBe('E2E Plantilla LED');
      expect(res.body.circuitData).toEqual(circuitData);
      expect(res.body.code).toBe(cppCode);

      expect(res.body).not.toHaveProperty('userId');
      expect(res.body).not.toHaveProperty('user');
      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('shareSlug');
    });

    it('un proyecto no plantilla retorna 404 aunque sea pÃºblico', async () => {
      await request(app.getHttpServer())
        .get(`/projects/templates/${publicProjectSlug}`)
        .expect(404);
    });

    it('un slug inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .get('/projects/templates/noexis')
        .expect(404);
    });
  });

  describe('PATCH /projects/:id/template (autenticado)', () => {
    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${templateId}/template`)
        .send({ isTemplate: false })
        .expect(401);
    });

    it('un STUDENT no puede marcar plantillas (ni siquiera propias)', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${studentProjectId}/template`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ isTemplate: true })
        .expect(403);

      const row = await prisma.project.findUnique({
        where: { id: studentProjectId },
      });
      expect(row?.isTemplate).toBe(false);
    });

    it('un TEACHER no dueÃ±o retorna 403', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${templateId}/template`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({ isTemplate: false })
        .expect(403);
    });

    it('el TEACHER dueÃ±o puede marcar y desmarcar su proyecto', async () => {
      const mark = await request(app.getHttpServer())
        .patch(`/projects/${publicProjectId}/template`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isTemplate: true })
        .expect(200);

      expect(mark.body.isTemplate).toBe(true);

      // ahora sÃ­ aparece en la ruta pÃºblica de plantillas
      await request(app.getHttpServer())
        .get(`/projects/templates/${publicProjectSlug}`)
        .expect(200);

      const unmark = await request(app.getHttpServer())
        .patch(`/projects/${publicProjectId}/template`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isTemplate: false })
        .expect(200);

      expect(unmark.body.isTemplate).toBe(false);
      await request(app.getHttpServer())
        .get(`/projects/templates/${publicProjectSlug}`)
        .expect(404);
    });

    it('un ADMIN puede marcar plantillas de otros docentes', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${publicProjectId}/template`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isTemplate: true })
        .expect(200);

      expect(res.body.isTemplate).toBe(true);

      await request(app.getHttpServer())
        .patch(`/projects/${publicProjectId}/template`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isTemplate: false })
        .expect(200);
    });

    it('un proyecto inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .patch('/projects/00000000-0000-4000-8000-000000000000/template')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isTemplate: true })
        .expect(404);
    });

    it('el body sin isTemplate o no booleano retorna 400', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${templateId}/template`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/projects/${templateId}/template`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isTemplate: 'sÃ­' })
        .expect(400);
    });
  });
});
