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
 * E2E del módulo Classrooms (aulas + inscripción por código):
 * - el docente crea el aula y recibe un código de unión
 * - el alumno se inscribe con POST /classrooms/join { code }
 * - visibilidad y entregas de guías restringidas por inscripción
 */
describe('Classrooms (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let adminToken: string;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdGuideIds: string[] = [];
  const createdClassroomIds: string[] = [];

  const PASSWORD = 'Password123!';

  const PROJECT = {
    title: 'E2E Aulas Proyecto plantilla',
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

    const [teacher, otherTeacher, student, otherStudent, admin] =
      await Promise.all([
        prisma.user.create({
          data: {
            email: 'e2e-classrooms-teacher@test.com',
            name: 'Docente Aulas E2E',
            role: Role.TEACHER,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            email: 'e2e-classrooms-teacher2@test.com',
            name: 'Otra Docente Aulas E2E',
            role: Role.TEACHER,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            email: 'e2e-classrooms-student@test.com',
            name: 'Alumno Aulas E2E',
            role: Role.STUDENT,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            email: 'e2e-classrooms-student2@test.com',
            name: 'Otro Alumno Aulas E2E',
            role: Role.STUDENT,
            passwordHash,
          },
        }),
        prisma.user.create({
          data: {
            email: 'e2e-classrooms-admin@test.com',
            name: 'Admin Aulas E2E',
            role: Role.ADMIN,
            passwordHash,
          },
        }),
      ]);

    createdUserIds.push(
      teacher.id,
      otherTeacher.id,
      student.id,
      otherStudent.id,
      admin.id,
    );

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
    adminToken = await login(admin.email);
  });

  afterAll(async () => {
    if (prisma) {
      // Las guías borradas eliminan sus entregas en cascada; las aulas, sus inscripciones
      await prisma.guide.deleteMany({ where: { id: { in: createdGuideIds } } });
      await prisma.classroom.deleteMany({
        where: { id: { in: createdClassroomIds } },
      });
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

  const createClassroom = async (token: string, name: string) => {
    const res = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);

    createdClassroomIds.push(res.body.id as string);
    return res.body as { id: string; code: string };
  };

  const createGuide = async (token: string, title: string, classroomId: string) => {
    const starterProjectId = await createProject(token, `${title} (plantilla)`);

    const res = await request(app.getHttpServer())
      .post('/guides')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title,
        instructions: 'Reproducí el circuito plantilla.',
        starterProjectId,
        classroomId,
      })
      .expect(201);

    createdGuideIds.push(res.body.id as string);
    return res.body as { id: string };
  };

  describe('POST /classrooms', () => {
    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/classrooms')
        .send({ name: 'E2E Aula sin token' })
        .expect(401);
    });

    it('con rol STUDENT retorna 403', async () => {
      await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'E2E Aula alumno' })
        .expect(403);
    });

    it('con rol ADMIN retorna 403 (solo TEACHER crea aulas)', async () => {
      await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Aula admin' })
        .expect(403);
    });

    it('con rol TEACHER crea el aula con código y contadores en 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'E2E Aula creación' })
        .expect(201);

      createdClassroomIds.push(res.body.id as string);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBeDefined();
      expect(res.body.code).toHaveLength(6);
      expect(res.body.memberCount).toBe(0);
      expect(res.body.guideCount).toBe(0);
      expect(res.body.teacher.id).toBeDefined();
    });

    it('retorna 400 si falta el nombre', async () => {
      await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('flujo: aula, guía e inscripción por código', () => {
    let aula: { id: string; code: string };
    let guideId: string;
    let studentProjectId: string;

    beforeAll(async () => {
      aula = await createClassroom(teacherToken, 'E2E Aula Flujo');
      const guide = await createGuide(
        teacherToken,
        'E2E Aulas - Guía entregable',
        aula.id,
      );
      guideId = guide.id;
      studentProjectId = await createProject(studentToken, 'E2E Proyecto alumno');

      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: aula.code })
        .expect(201);
    });

    it('GET /classrooms sin token retorna 401', async () => {
      await request(app.getHttpServer()).get('/classrooms').expect(401);
    });

    it('el docente lista sus aulas con el código', async () => {
      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const found = res.body.find((c: { id: string }) => c.id === aula.id);
      expect(found).toBeDefined();
      expect(found.code).toBe(aula.code);
      expect(found.memberCount).toBe(1);
      expect(found.guideCount).toBe(1);
    });

    it('el alumno lista sus aulas SIN el código', async () => {
      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const found = res.body.find((c: { id: string }) => c.id === aula.id);
      expect(found).toBeDefined();
      expect(found.code).toBeUndefined();
    });

    it('el alumno no inscripto no ve el aula (404)', async () => {
      await request(app.getHttpServer())
        .get(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(404);
    });

    it('el alumno inscripto ve el aula; otro docente, no (404)', async () => {
      await request(app.getHttpServer())
        .get(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(404);
    });

    it('GET /classrooms/:id/students como dueño lista inscriptos', async () => {
      const res = await request(app.getHttpServer())
        .get(`/classrooms/${aula.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe('e2e-classrooms-student@test.com');
      expect(res.body[0]).not.toHaveProperty('passwordHash');
      expect(res.body[0].joinedAt).toBeDefined();
    });

    it('GET /classrooms/:id/students como alumno retorna 403', async () => {
      await request(app.getHttpServer())
        .get(`/classrooms/${aula.id}/students`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('el alumno inscripto ve la guía del aula; el no inscripto, no (404)', async () => {
      const visible = await request(app.getHttpServer())
        .get(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(visible.body.classroom.id).toBe(aula.id);

      await request(app.getHttpServer())
        .get(`/guides/${guideId}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(404);
    });

    it('el alumno inscripto entrega su proyecto a la guía', async () => {
      const res = await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ guideId, projectId: studentProjectId })
        .expect(201);

      expect(res.body.guide.id).toBe(guideId);
    });

    it('el alumno no inscripto no puede entregar (403)', async () => {
      const foreignProjectId = await createProject(
        otherStudentToken,
        'E2E Aulas Proyecto ajeno al aula',
      );

      await request(app.getHttpServer())
        .post('/submissions')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ guideId, projectId: foreignProjectId })
        .expect(403);
    });
  });

  describe('POST /classrooms/join', () => {
    let aula: { id: string; code: string };

    beforeAll(async () => {
      aula = await createClassroom(teacherToken, 'E2E Aula Join');
    });

    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/classrooms/join')
        .send({ code: aula.code })
        .expect(401);
    });

    it('con rol TEACHER retorna 403', async () => {
      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ code: aula.code })
        .expect(403);
    });

    it('con un código inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'zzzzzz' })
        .expect(404);
    });

    it('inscripción exitosa retorna el aula con memberCount 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: aula.code })
        .expect(201);

      expect(res.body.id).toBe(aula.id);
      expect(res.body.memberCount).toBe(1);
      expect(res.body.code).toBeUndefined();
    });

    it('unirse dos veces al mismo aula retorna 409', async () => {
      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: aula.code })
        .expect(409);
    });
  });

  describe('POST /classrooms/:id/regenerate-code', () => {
    let aula: { id: string; code: string };

    beforeAll(async () => {
      aula = await createClassroom(teacherToken, 'E2E Aula Regenerate');
    });

    it('el viejo código deja de funcionar y el nuevo sirve', async () => {
      const res = await request(app.getHttpServer())
        .post(`/classrooms/${aula.id}/regenerate-code`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201);

      const newCode = res.body.code as string;
      expect(newCode).toBeDefined();
      expect(newCode).not.toBe(aula.code);

      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ code: aula.code })
        .expect(404);

      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ code: newCode })
        .expect(201);
    });

    it('otro docente no puede regenerar el código (403)', async () => {
      await request(app.getHttpServer())
        .post(`/classrooms/${aula.id}/regenerate-code`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(403);
    });

    it('con un aula inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .post('/classrooms/00000000-0000-4000-8000-000000000000/regenerate-code')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('un alumno no puede regenerar el código (403)', async () => {
      await request(app.getHttpServer())
        .post(`/classrooms/${aula.id}/regenerate-code`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('DELETE /classrooms/:id', () => {
    it('retorna 409 si el aula tiene guías', async () => {
      const aula = await createClassroom(teacherToken, 'E2E Aula Con Guías');
      await createGuide(teacherToken, 'E2E Aulas - guía que bloquea', aula.id);

      await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(409);
    });

    it('elimina un aula sin guías junto con sus inscripciones', async () => {
      const aula = await createClassroom(teacherToken, 'E2E Aula Borrable');

      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ code: aula.code })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      // El alumno ya no está inscripto ni ve el aula
      await request(app.getHttpServer())
        .get(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(404);

      createdClassroomIds.splice(createdClassroomIds.indexOf(aula.id), 1);
    });

    it('otro docente no puede eliminarla (403)', async () => {
      const aula = await createClassroom(teacherToken, 'E2E Aula Ajena');

      await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(403);
    });

    it('el admin puede eliminar un aula ajena', async () => {
      const aula = await createClassroom(teacherToken, 'E2E Aula Admin Delete');

      await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      createdClassroomIds.splice(createdClassroomIds.indexOf(aula.id), 1);
    });

    it('con un aula inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .delete('/classrooms/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });
  });

  describe('DELETE /classrooms/:id/students/:studentId', () => {
    let aula: { id: string; code: string };
    let studentId: string;

    beforeAll(async () => {
      aula = await createClassroom(teacherToken, 'E2E Aula Miembros');

      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      studentId = me.body.id as string;

      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: aula.code })
        .expect(201);
    });

    it('un alumno no puede sacar a otro alumno (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}/students/${studentId}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(403);
    });

    it('el miembro inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}/students/00000000-0000-4000-8000-000000000000`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('el docente dueño puede quitar a un alumno', async () => {
      await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}/students/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/classrooms/${aula.id}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('el alumno puede salir del aula por sí mismo', async () => {
      await request(app.getHttpServer())
        .post('/classrooms/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: aula.code })
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/classrooms/${aula.id}/students/${studentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.message).toBe('te retiraste del aula');
    });

    it('con un aula inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .delete(
          `/classrooms/00000000-0000-4000-8000-000000000000/students/${studentId}`,
        )
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });
  });
});
