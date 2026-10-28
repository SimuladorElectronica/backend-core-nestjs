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
 * Evidencia (Supertest) del CRUD de CuratedLibrary:
 * - lectura pública (GET / GET :id)
 * - escritura solo rol TEACHER (401 sin token, 403 con STUDENT)
 * - ciclo completo create → update → delete y errores 409/404
 */
describe('Libraries (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let teacherToken: string;
  let studentToken: string;

  const createdUserIds: string[] = [];
  let libraryId: string | null = null;

  const PASSWORD = 'Password123!';
  const LIBRARY = {
    name: 'E2E_Libreria',
    headerFile: 'E2E_Libreria.h',
    author: 'Equipo E2E',
    description: 'Librería creada por las pruebas de integración',
    version: '1.0.0',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Usuarios de prueba con el mismo esquema de hash que usa el registro real
    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
    });

    const teacher = await prisma.user.create({
      data: {
        email: 'e2e-teacher@test.com',
        name: 'Docente E2E',
        role: Role.TEACHER,
        passwordHash,
      },
    });
    const student = await prisma.user.create({
      data: {
        email: 'e2e-student@test.com',
        name: 'Alumno E2E',
        role: Role.STUDENT,
        passwordHash,
      },
    });
    createdUserIds.push(teacher.id, student.id);

    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(201)
        .then((res) => res.body.access_token as string);

    teacherToken = await login(teacher.email);
    studentToken = await login(student.email);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.curatedLibrary.deleteMany({
        where: { name: LIBRARY.name },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (app) {
      await app.close();
    }
  });

  it('GET /libraries es público (sin token)', async () => {
    const res = await request(app.getHttpServer())
      .get('/libraries')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /libraries sin token retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/libraries')
      .send(LIBRARY)
      .expect(401);
  });

  it('POST /libraries con rol STUDENT retorna 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/libraries')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(LIBRARY)
      .expect(403);

    expect(res.body.error).toBe('Forbidden');
  });

  it('POST /libraries con rol TEACHER crea la librería', async () => {
    const res = await request(app.getHttpServer())
      .post('/libraries')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(LIBRARY)
      .expect(201);

    libraryId = res.body.id;
    expect(res.body.name).toBe(LIBRARY.name);
    expect(res.body.version).toBe(LIBRARY.version);
  });

  it('POST /libraries con nombre duplicado retorna 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/libraries')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(LIBRARY)
      .expect(409);

    expect(res.body.error).toBe('Conflict');
  });

  it('GET /libraries/:id retorna la librería creada', async () => {
    const res = await request(app.getHttpServer())
      .get(`/libraries/${libraryId}`)
      .expect(200);

    expect(res.body.name).toBe(LIBRARY.name);
  });

  it('PUT /libraries/:id como TEACHER actualiza la versión', async () => {
    const res = await request(app.getHttpServer())
      .put(`/libraries/${libraryId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ version: '2.0.0' })
      .expect(200);

    expect(res.body.version).toBe('2.0.0');
  });

  it('PUT /libraries/:id como STUDENT retorna 403', async () => {
    await request(app.getHttpServer())
      .put(`/libraries/${libraryId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ version: '9.9.9' })
      .expect(403);
  });

  it('DELETE /libraries/:id como TEACHER elimina la librería', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/libraries/${libraryId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(res.body.id).toBe(libraryId);
  });

  it('GET /libraries/:id después de borrar retorna 404', async () => {
    await request(app.getHttpServer())
      .get(`/libraries/${libraryId}`)
      .expect(404);
  });
});
