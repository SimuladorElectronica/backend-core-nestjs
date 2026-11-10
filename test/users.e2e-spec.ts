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
 * Evidencia (Supertest) de la gestión de usuarios:
 * - PATCH /users/:id/role solo rol ADMIN (401 sin token, 403 STUDENT/TEACHER)
 * - 400 UUID inválido o rol inválido, 404 usuario inexistente, 403 auto-cambio
 * - ADMIN promueve a un STUDENT a TEACHER y ese usuario puede crear una
 *   guía (POST /guides) con el mismo token, sin volver a loguearse
 *   (JwtStrategy carga el rol desde la DB en cada request).
 * - GET /users y GET /users/:id (solo ADMIN) sin exponer passwordHash
 * - PATCH /users/me y PATCH /users/me/password
 * - DELETE /users/:id: baja lógica (isActive=false) que invalida el login
 *   y los tokens vigentes
 */
describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string;
  let promotableToken: string;
  let accountToken: string;
  let deletableToken: string;
  let adminId: string;
  let promotableId: string;
  let accountId: string;
  let deletableId: string;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdGuideIds: string[] = [];

  const PASSWORD = 'Password123!';
  const NEW_PASSWORD = 'NuevaPassword456!';

  const ACCOUNT_EMAIL = 'e2e-users-account@test.com';
  const ACCOUNT_NEW_EMAIL = 'e2e-users-account-edited@test.com';
  const DELETABLE_EMAIL = 'e2e-users-deletable@test.com';

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
    const account = await prisma.user.create({
      data: {
        email: ACCOUNT_EMAIL,
        name: 'Alumno Cuenta',
        role: Role.STUDENT,
        passwordHash,
      },
    });
    const deletable = await prisma.user.create({
      data: {
        email: DELETABLE_EMAIL,
        name: 'Alumno Desactivable',
        role: Role.STUDENT,
        passwordHash,
      },
    });
    adminId = admin.id;
    promotableId = promotable.id;
    accountId = account.id;
    deletableId = deletable.id;
    createdUserIds.push(
      admin.id,
      teacher.id,
      promotable.id,
      account.id,
      deletable.id,
    );

    const login = (email: string, password = PASSWORD) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201)
        .then((res) => res.body.access_token as string);

    adminToken = await login(admin.email);
    teacherToken = await login(teacher.email);
    promotableToken = await login(promotable.email);
    accountToken = await login(account.email);
    deletableToken = await login(deletable.email);
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

  describe('PATCH /users/:id/role', () => {
    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${promotableId}/role`)
        .send({ role: Role.TEACHER })
        .expect(401);
    });

    it('con rol STUDENT retorna 403', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${promotableId}/role`)
        .set('Authorization', `Bearer ${promotableToken}`)
        .send({ role: Role.TEACHER })
        .expect(403);

      expect(res.body.error).toBe('Forbidden');
    });

    it('con rol TEACHER retorna 403', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${promotableId}/role`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ role: Role.TEACHER })
        .expect(403);

      expect(res.body.error).toBe('Forbidden');
    });

    it('con UUID inválido retorna 400', async () => {
      await request(app.getHttpServer())
        .patch('/users/no-uuid/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.TEACHER })
        .expect(400);
    });

    it('con rol inválido retorna 400', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${promotableId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SUPERUSER' })
        .expect(400);
    });

    it('con usuario inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .patch('/users/00000000-0000-4000-8000-000000000000/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.TEACHER })
        .expect(404);
    });

    it('de sí mismo como ADMIN retorna 403', async () => {
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

  describe('GET /users', () => {
    it('sin token retorna 401', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('con rol TEACHER retorna 403', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });

    it('ADMIN lista usuarios con X-Total-Count y sin passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ take: 10, skip: 0 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(Number(res.headers['x-total-count'])).toBeGreaterThanOrEqual(1);
      expect(
        res.body.every(
          (u: Record<string, unknown>) => !('passwordHash' in u),
        ),
      ).toBe(true);
      expect(
        res.body.some((u: { id: string }) => u.id === adminId),
      ).toBe(true);
    });

    it('filtra por rol y búsqueda', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ role: Role.STUDENT, search: 'e2e-users-account' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(accountId);
      expect(res.body[0].isActive).toBe(true);
    });

    it('con take inválido retorna 400', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .query({ take: 0 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .get(`/users/${accountId}`)
        .expect(401);
    });

    it('con rol STUDENT retorna 403', async () => {
      await request(app.getHttpServer())
        .get(`/users/${accountId}`)
        .set('Authorization', `Bearer ${accountToken}`)
        .expect(403);
    });

    it('con UUID inválido retorna 400', async () => {
      await request(app.getHttpServer())
        .get('/users/no-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('con usuario inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .get('/users/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('ADMIN obtiene el usuario con su estado y sin passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${accountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toEqual({
        id: accountId,
        email: ACCOUNT_EMAIL,
        name: 'Alumno Cuenta',
        role: Role.STUDENT,
        isActive: true,
      });
    });
  });

  describe('PATCH /users/me', () => {
    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .send({ name: 'Sin token' })
        .expect(401);
    });

    it('con rol STUDENT actualiza su propio perfil', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${accountToken}`)
        .send({ name: 'Alumno Cuenta Editado', email: ACCOUNT_NEW_EMAIL })
        .expect(200);

      expect(res.body).toEqual({
        id: accountId,
        email: ACCOUNT_NEW_EMAIL,
        name: 'Alumno Cuenta Editado',
        role: Role.STUDENT,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('con un email ya registrado retorna 409', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${accountToken}`)
        .send({ email: DELETABLE_EMAIL })
        .expect(409);
    });

    it('ignora el campo role enviado en el body (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${accountToken}`)
        .send({ name: 'Alumno Cuenta Editado', role: Role.ADMIN })
        .expect(200);

      expect(res.body.role).toBe(Role.STUDENT);
    });
  });

  describe('PATCH /users/me/password', () => {
    it('con contraseña actual incorrecta retorna 400', async () => {
      await request(app.getHttpServer())
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${accountToken}`)
        .send({ currentPassword: 'Incorrecta123!', newPassword: NEW_PASSWORD })
        .expect(400);
    });

    it('cambia la contraseña y permite loguearse con la nueva', async () => {
      await request(app.getHttpServer())
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${accountToken}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ACCOUNT_NEW_EMAIL, password: PASSWORD })
        .expect(401);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ACCOUNT_NEW_EMAIL, password: NEW_PASSWORD })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
    });
  });

  describe('DELETE /users/:id', () => {
    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${deletableId}`)
        .expect(401);
    });

    it('con rol STUDENT retorna 403', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${deletableId}`)
        .set('Authorization', `Bearer ${accountToken}`)
        .expect(403);
    });

    it('con UUID inválido retorna 400', async () => {
      await request(app.getHttpServer())
        .delete('/users/no-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('con usuario inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .delete('/users/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('el ADMIN no puede desactivarse a sí mismo (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('ADMIN desactiva a un usuario y le invalida login y token', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/users/${deletableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toEqual({
        message: 'Usuario desactivado',
        id: deletableId,
      });

      // La cuenta queda marcada como inactiva
      const detail = await request(app.getHttpServer())
        .get(`/users/${deletableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detail.body.isActive).toBe(false);

      // Ni el login ni el token previo siguen funcionando
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: DELETABLE_EMAIL, password: PASSWORD })
        .expect(401);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${deletableToken}`)
        .expect(401);
    });
  });
});
