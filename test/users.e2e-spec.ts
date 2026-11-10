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
 * Evidencia (Supertest) de la promoción de roles:
 * - PATCH /users/:id/role solo rol ADMIN (401 sin token, 403 STUDENT/TEACHER)
 * - 400 UUID inválido o rol inválido, 404 usuario inexistente, 403 auto-cambio
 * - ADMIN promueve a un STUDENT a TEACHER y ese usuario puede crear una
 *   guía (POST /guides) con el mismo token, sin volver a loguearse
 *   (JwtStrategy carga el rol desde la DB en cada request).
 */
describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string;
  let promotableToken: string;
  let adminId: string;
  let promotableId: string;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdGuideIds: string[] = [];

  const PASSWORD = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
    });

    const admin = await prisma.user.create({
      data: {
        email: 'e2e-users-admin@test.com',
        name: 'Admin Users E2E',
        role: Role.ADMIN,
        passwordHash,
      },
    });
    const teacher = await prisma.user.create({
      data: {
        email: 'e2e-users-teacher@test.com',
        name: 'Docente Users E2E',
        role: Role.TEACHER,
        passwordHash,
      },
    });
    const promotable = await prisma.user.create({
      data: {
        email: 'e2e-users-student@test.com',
        name: 'Alumno Users E2E',
        role: Role.STUDENT,
        passwordHash,
      },
    });
    adminId = admin.id;
    promotableId = promotable.id;
    createdUserIds.push(admin.id, teacher.id, promotable.id);

    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(201)
        .then((res) => res.body.access_token as string);

    adminToken = await login(admin.email);
    teacherToken = await login(teacher.email);
    promotableToken = await login(promotable.email);
  });

  afterAll(async () => {
    if (prisma) {
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

  it('PATCH /users/:id/role sin token retorna 401', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${promotableId}/role`)
      .send({ role: Role.TEACHER })
      .expect(401);
  });

  it('PATCH /users/:id/role con rol STUDENT retorna 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${promotableId}/role`)
      .set('Authorization', `Bearer ${promotableToken}`)
      .send({ role: Role.TEACHER })
      .expect(403);

    expect(res.body.error).toBe('Forbidden');
  });

  it('PATCH /users/:id/role con rol TEACHER retorna 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${promotableId}/role`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ role: Role.TEACHER })
      .expect(403);

    expect(res.body.error).toBe('Forbidden');
  });

  it('PATCH /users/:id/role con UUID inválido retorna 400', async () => {
    await request(app.getHttpServer())
      .patch('/users/no-uuid/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.TEACHER })
      .expect(400);
  });

  it('PATCH /users/:id/role con rol inválido retorna 400', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${promotableId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SUPERUSER' })
      .expect(400);
  });

  it('PATCH /users/:id/role con usuario inexistente retorna 404', async () => {
    await request(app.getHttpServer())
      .patch('/users/00000000-0000-4000-8000-000000000000/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.TEACHER })
      .expect(404);
  });

  it('PATCH /users/:id/role de sí mismo como ADMIN retorna 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${adminId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.STUDENT })
      .expect(403);

    expect(res.body.error).toBe('Forbidden');
  });

  it('ADMIN promueve a un STUDENT a TEACHER sin exponer passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${promotableId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.TEACHER })
      .expect(200);

    expect(res.body).toEqual({
      id: promotableId,
      email: 'e2e-users-student@test.com',
      name: 'Alumno Users E2E',
      role: Role.TEACHER,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('el usuario promovido puede crear una guía sin volver a loguearse', async () => {
    // El token promotableToken se obtuvo cuando el usuario era STUDENT:
    // JwtStrategy recarga el rol desde la DB, así que ya puede crear guías.
    const project = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${promotableToken}`)
      .send({
        title: 'E2E Proyecto plantilla del promovido',
        circuitData: { components: [], wires: [] },
        code: 'void setup() {}',
      })
      .expect(201);

    createdProjectIds.push(project.body.id as string);

    const res = await request(app.getHttpServer())
      .post('/guides')
      .set('Authorization', `Bearer ${promotableToken}`)
      .send({
        title: 'E2E Guía creada tras la promoción',
        instructions: 'Instrucciones de la guía creada tras la promoción.',
        starterProjectId: project.body.id as string,
      })
      .expect(201);

    createdGuideIds.push(res.body.id as string);
    expect(res.body.title).toBe('E2E Guía creada tras la promoción');
    expect(res.body.teacher.id).toBe(promotableId);
  });
});
