import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Criterios de aceptación de la issue:
 * 1. Un guardado anónimo genera un registro en PostgreSQL con shareSlug de 6 caracteres.
 * 2. La consulta por shareSlug retorna circuitData (JSONB) y el código C++ en < 50 ms.
 */
describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdProjectIds: string[] = [];

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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdProjectIds.length > 0 && prisma) {
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  it('POST /projects sin token crea el registro en PostgreSQL con shareSlug de 6 caracteres', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .send({
        title: 'Circuito compartible',
        circuitData,
        code: cppCode,
      })
      .expect(201);

    createdProjectIds.push(response.body.id);

    expect(response.body.shareSlug).toMatch(/^[a-z0-9]{6}$/);
    expect(response.body.shareSlug).toHaveLength(6);
    expect(response.body.userId).toBeNull();
    expect(response.body.shareUrl).toContain(response.body.shareSlug);

    // Verificación directa en la base de datos
    const row = await prisma.project.findUnique({
      where: { id: response.body.id },
    });

    expect(row).not.toBeNull();
    expect(row?.userId).toBeNull();
    expect(row?.shareSlug).toBe(response.body.shareSlug);
    expect(row?.circuitData).toEqual(circuitData);
    expect(row?.code).toBe(cppCode);
  });

  it('GET /projects/:shareSlug retorna circuitData (JSONB) y el código C++ en menos de 50 ms', async () => {
    const shareSlug = await request(app.getHttpServer())
      .post('/projects')
      .send({ title: 'Benchmark', circuitData, code: cppCode })
      .expect(201);

    createdProjectIds.push(shareSlug.body.id);

    // Warm-up: la primera request abre la conexión fría, no se mide
    await request(app.getHttpServer())
      .get(`/projects/${shareSlug.body.shareSlug}`)
      .expect(200);

    const start = performance.now();
    const response = await request(app.getHttpServer())
      .get(`/projects/${shareSlug.body.shareSlug}`)
      .expect(200);
    const elapsed = performance.now() - start;

    expect(response.body.circuitData).toEqual(circuitData);
    expect(response.body.code).toBe(cppCode);
    expect(response.body.shareSlug).toBe(shareSlug.body.shareSlug);
    // eslint-disable-next-line no-console
    console.log(`GET /projects/:shareSlug → ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(50);
  });

  it('GET /projects/:shareSlug inexistente retorna 404', async () => {
    await request(app.getHttpServer()).get('/projects/xxxxxx').expect(404);
  });

  it('GET /projects con clave no válida retorna 404', async () => {
    await request(app.getHttpServer()).get('/projects/no-existe').expect(404);
  });
});
