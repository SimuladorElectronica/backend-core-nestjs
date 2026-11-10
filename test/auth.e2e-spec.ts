import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Seguridad de registro: RegisterDto no acepta `role`.
 * Con ValidationPipe({ whitelist: true }) el campo extra se descarta
 * y el usuario queda creado como STUDENT (rol por defecto).
 */
describe('Auth register (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let createdUserId: string | null = null;

  const EMAIL = 'e2e-register-role@test.com';
  const PASSWORD = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma && createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    if (app) {
      await app.close();
    }
  });

  it('POST /auth/register con role=ADMIN lo descarta y crea STUDENT', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Intento Admin',
        email: EMAIL,
        password: PASSWORD,
        role: Role.ADMIN,
      })
      .expect(201);

    expect(res.body.access_token).toBeDefined();

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.access_token as string}`)
      .expect(200);

    expect(me.body.email).toBe(EMAIL);
    expect(me.body.name).toBe('Intento Admin');
    expect(me.body.role).toBe(Role.STUDENT);

    createdUserId = me.body.id as string;
  });
});
