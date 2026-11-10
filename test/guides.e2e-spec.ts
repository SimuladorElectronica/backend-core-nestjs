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
 * Evidencia (Supertest) de la Issue 3.4 - Guías docentes y entregas:
 * - POST /guides solo rol TEACHER (401 sin token, 403 con STUDENT)
 * - vinculación con proyecto plantilla (404 si no existe)
 * - GET /guides y GET /guides/:id de lectura pública
 * - POST /submissions con sesión, validando pertenencia del proyecto (403)
 */
describe('Guides & Submissions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let teacherId: string;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdGuideIds: string[] = [];

  const PASSWORD = 'Password123!';

  const GUIDE = {
    title: 'E2E - LED parpadeante',
    instructions:
      'Conectá un LED al pin 13 con resistencia de 220Ω y hacélo parpadear cada segundo.',
  };

  const PROJECT = {
    title: 'E2E Proyecto plantilla',
    circuitData: { components: [{ id: 'r1', type: 'resistor' }], wires: [] },
    code: 'void setup() { pinMode(13, OUTPUT); }',
  };

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

    const teacher = await prisma.user.create({
      data: {
        email: 'e2e-guides-teacher@test.com',
        name: 'Docente Guías E2E',
        role: Role.TEACHER,
        passwordHash,
      },
    });
    const otherTeacher = await prisma.user.create({
      data: {
        email: 'e2e-guides-teacher2@test.com',
        name: 'Otro Docente E2E',
        role: Role.TEACHER,
        passwordHash,
      },
    });
    const student = await prisma.user.create({
      data: {
        email: 'e2e-guides-student@test.com',
        name: 'Alumno Guías E2E',
        role: Role.STUDENT,
        passwordHash,
      },
    });
    const otherStudent = await prisma.user.create({
      data: {
        email: 'e2e-guides-student2@test.com',
        name: 'Otro Alumno E2E',
        role: Role.STUDENT,
        passwordHash,
      },
    });
    teacherId = teacher.id;
    createdUserIds.push(teacher.id, otherTeacher.id, student.id, otherStudent.id);

    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(201)
        .then((res) => res.body.access_token as string);

    teacherToken = await login(teacher.email);
    otherTeacherToken = await login(otherTeacher.email);
    studentToken = await login(student.email);
    otherStudentToken = await login(otherStudent.email);
  });

  afterAll(async () => {
    if (prisma) {
      // Las guías borradas eliminan sus entregas en cascada
      await prisma.guide.deleteMany({ where: { id: { in: createdGuideIds } } });
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (app) {
      await app.close();
    }
  });

  const createProject = async (token: string, title: string) => {
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PROJECT, title })
      .expect(201);

    createdProjectIds.push(res.body.id as string);
    return res.body.id as string;
  };

  describe('POST /guides', () => {
    let starterProjectId: string;
    let studentProjectId: string;

    beforeAll(async () => {
      starterProjectId = await createProject(
        teacherToken,
        'E2E Proyecto plantilla',
      );
      studentProjectId = await createProject(
        studentToken,
        'E2E Proyecto del alumno',
      );
    });

    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/guides')
        .send({ ...GUIDE, starterProjectId })
        .expect(401);
    });

    it('con rol STUDENT retorna 403 (criterio de aceptación)', async () => {
      const res = await request(app.getHttpServer())
        .post('/guides')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ ...GUIDE, starterProjectId })
        .expect(403);

      expect(res.body.error).toBe('Forbidden');
    });

    it('con rol TEACHER crea la guía vinculada al proyecto plantilla', async () => {
      const res = await request(app.getHttpServer())
        .post('/guides')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ ...GUIDE, starterProjectId })
        .expect(201);

      createdGuideIds.push(res.body.id as string);

      expect(res.body.title).toBe(GUIDE.title);
      expect(res.body.instructions).toBe(GUIDE.instructions);
      expect(res.body.starterProject.id).toBe(starterProjectId);
      expect(res.body.teacher.id).toBeDefined();
    });

    it('retorna 404 si el proyecto plantilla no existe', async () => {
      await request(app.getHttpServer())
        .post('/guides')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          ...GUIDE,
          starterProjectId: '00000000-0000-4000-8000-000000000000',
        })
        .expect(404);
    });

    it('retorna 400 si faltan campos obligatorios', async () => {
      await request(app.getHttpServer())
        .post('/guides')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Sin instrucciones' })
        .expect(400);
    });

    it('estudiante sube su proyecto para usarlo como entrega', async () => {
      expect(studentProjectId).toBeDefined();
    });
  });

  describe('GET /guides', () => {
    it('el listado es público (sin token)', async () => {
      const res = await request(app.getHttpServer())
        .get('/guides')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.some((g: { title: string }) => g.title === GUIDE.title),
      ).toBe(true);
    });

    it('GET /guides?teacherId= filtra las guías del docente', async () => {
      const res = await request(app.getHttpServer())
        .get('/guides')
        .query({ teacherId })
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      expect(
        res.body.every(
          (g: { teacher: { id: string } }) => g.teacher.id === teacherId,
        ),
      ).toBe(true);
    });

    it('GET /guides con teacherId inválido retorna 400', async () => {
      await request(app.getHttpServer())
        .get('/guides')
        .query({ teacherId: 'no-uuid' })
        .expect(400);
    });

    it('GET /guides/:id retorna la guía con instrucciones', async () => {
      const list = await request(app.getHttpServer()).get('/guides').expect(200);
      const guide = list.body.find(
        (g: { title: string }) => g.title === GUIDE.title,
      );

      const res = await request(app.getHttpServer())
        .get(`/guides/${guide.id}`)
        .expect(200);

      expect(res.body.instructions).toBe(GUIDE.instructions);
      expect(res.body.starterProject).toBeDefined();
    });

    it('GET /guides/:id con UUID inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .get('/guides/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });

    it('GET /guides/:id con formato inválido retorna 400', async () => {
      await request(app.getHttpServer()).get('/guides/no-uuid').expect(400);
    });
  });

  describe('PUT /guides/:id y DELETE /guides/:id', () => {
    let guideId: string;
    let starterProjectId: string;

    beforeAll(async () => {
      starterProjectId = await createProject(
        teacherToken,
        'E2E Proyecto plantilla para editar',
      );

      const res = await request(app.getHttpServer())
        .post('/guides')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'E2E Guía editable',
          instructions: 'Instrucciones originales',
          starterProjectId,
        })
        .expect(201);

      guideId = res.body.id as string;
      createdGuideIds.push(guideId);
    });

    it('PUT sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .put(`/guides/${guideId}`)
        .send({ title: 'Editada' })
        .expect(401);
    });

    it('PUT con rol STUDENT retorna 403', async () => {
      await request(app.getHttpServer())
        .put(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Editada' })
        .expect(403);
    });

    it('PUT como dueño actualiza los campos enviados', async () => {
      const res = await request(app.getHttpServer())
        .put(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'E2E Guía editada', instructions: 'Instrucciones nuevas' })
        .expect(200);

      expect(res.body.title).toBe('E2E Guía editada');
      expect(res.body.instructions).toBe('Instrucciones nuevas');
    });

    it('PUT con un proyecto plantilla inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .put(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ starterProjectId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
    });

    it('PUT de otro TEACHER sobre guía ajena retorna 403 (ownership)', async () => {
      await request(app.getHttpServer())
        .put(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({ title: 'Intento ajeno' })
        .expect(403);
    });

    it('DELETE de otro TEACHER sobre guía ajena retorna 403 (ownership)', async () => {
      await request(app.getHttpServer())
        .delete(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(403);
    });

    it('DELETE como dueño elimina la guía', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.id).toBe(guideId);
    });

    it('GET /guides/:id después de borrar retorna 404', async () => {
      await request(app.getHttpServer()).get(`/guides/${guideId}`).expect(404);
    });
  });

  describe('POST /submissions', () => {
    let guideId: string;
    let studentProjectId: string;

    beforeAll(async () => {
      const list = await request(app.getHttpServer()).get('/guides').expect(200);
      guideId = list.body.find(
        (g: { title: string }) => g.title === GUIDE.title,
      ).id as string;
      studentProjectId = await createProject(
        studentToken,
        'E2E Proyecto para entregar',
      );
    });

    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/submissions')
        .send({ guideId, projectId: studentProjectId })
        .expect(401);
    });

    it('con un proyecto propio registra la entrega', async () => {
      const res = await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ guideId, projectId: studentProjectId })
        .expect(201);

      expect(res.body.guide.id).toBe(guideId);
      expect(res.body.project.id).toBe(studentProjectId);
      expect(res.body.studentId).toBeDefined();
    });

    it('con el proyecto de otro usuario retorna 403', async () => {
      const teacherProjectId = await createProject(
        teacherToken,
        'E2E Proyecto del docente',
      );

      await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ guideId, projectId: teacherProjectId })
        .expect(403);
    });

    it('con una guía inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          guideId: '00000000-0000-4000-8000-000000000000',
          projectId: studentProjectId,
        })
        .expect(404);
    });

    it('retorna 400 si faltan campos obligatorios', async () => {
      await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ guideId })
        .expect(400);
    });
  });

  describe('GET, PUT y DELETE /submissions', () => {
    let submissionId: string;
    let guideId: string;

    beforeAll(async () => {
      const list = await request(app.getHttpServer()).get('/guides').expect(200);
      guideId = list.body.find(
        (g: { title: string }) => g.title === GUIDE.title,
      ).id as string;

      const projectId = await createProject(
        studentToken,
        'E2E Proyecto en entrega sujeta a cambio',
      );

      const res = await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ guideId, projectId })
        .expect(201);

      submissionId = res.body.id as string;
    });

    it('GET /submissions sin token retorna 401', async () => {
      await request(app.getHttpServer()).get('/submissions').expect(401);
    });

    it('GET /submissions como alumno lista solo sus entregas', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.some((s: { id: string }) => s.id === submissionId),
      ).toBe(true);
    });

    it('GET /submissions como docente lista las entregas de sus guías', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const found = res.body.find(
        (s: { id: string }) => s.id === submissionId,
      );

      expect(found).toBeDefined();
      // El docente puede identificar al alumno que entregó, sin passwordHash
      expect(found.student).toEqual({
        id: found.studentId,
        name: 'Alumno Guías E2E',
        email: 'e2e-guides-student@test.com',
      });
      expect(found.student).not.toHaveProperty('passwordHash');
    });

    it('GET /submissions?guideId= filtra y expone X-Total-Count', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions')
        .query({ guideId, take: 10, skip: 0 })
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Number(res.headers['x-total-count'])).toBeGreaterThanOrEqual(1);
      expect(
        res.body.every(
          (s: { guide: { id: string } }) => s.guide.id === guideId,
        ),
      ).toBe(true);
      expect(
        res.body.some((s: { id: string }) => s.id === submissionId),
      ).toBe(true);
    });

    it('GET /submissions con guideId inválido retorna 400', async () => {
      await request(app.getHttpServer())
        .get('/submissions')
        .query({ guideId: 'no-uuid' })
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);
    });

    it('GET /submissions/:id lo ve el alumno dueño', async () => {
      const res = await request(app.getHttpServer())
        .get(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.id).toBe(submissionId);
    });

    it('GET /submissions/:id lo ve el docente de la guía', async () => {
      await request(app.getHttpServer())
        .get(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
    });

    it('GET /submissions/:id retorna 404 para un tercero', async () => {
      await request(app.getHttpServer())
        .get(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(404);
    });

    it('PUT /submissions/:id sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .put(`/submissions/${submissionId}`)
        .send({ projectId: '00000000-0000-4000-8000-000000000000' })
        .expect(401);
    });

    it('PUT como el docente de la guía retorna 403 (no es su entrega)', async () => {
      await request(app.getHttpServer())
        .put(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ projectId: '00000000-0000-4000-8000-000000000000' })
        .expect(403);
    });

    it('PUT con el proyecto de otro alumno retorna 403', async () => {
      const foreignProjectId = await createProject(
        otherStudentToken,
        'E2E Proyecto ajeno para PUT',
      );

      await request(app.getHttpServer())
        .put(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: foreignProjectId })
        .expect(403);
    });

    it('PUT con un proyecto inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .put(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
    });

    it('PUT como dueño reemplaza el proyecto entregado', async () => {
      const newProjectId = await createProject(
        studentToken,
        'E2E Proyecto reemplazante',
      );

      const res = await request(app.getHttpServer())
        .put(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: newProjectId })
        .expect(200);

      expect(res.body.project.id).toBe(newProjectId);
    });

    it('DELETE sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .delete(`/submissions/${submissionId}`)
        .expect(401);
    });

    it('DELETE de otro alumno retorna 403', async () => {
      await request(app.getHttpServer())
        .delete(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(403);
    });

    it('DELETE como dueño retira la entrega', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.id).toBe(submissionId);
    });

    it('GET /submissions/:id después de borrar retorna 404', async () => {
      await request(app.getHttpServer())
        .get(`/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });
});
