import 'reflect-metadata';

const appStub = {
  enableCors: vi.fn(),
  useGlobalPipes: vi.fn(),
  listen: vi.fn(async () => undefined),
};

vi.mock('@nestjs/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@nestjs/core')>();
  return {
    ...original,
    NestFactory: { create: vi.fn(async () => appStub) },
  };
});

vi.mock('@nestjs/swagger', async (importOriginal) => {
  const original = await importOriginal<typeof import('@nestjs/swagger')>();
  return {
    ...original,
    SwaggerModule: {
      createDocument: vi.fn(() => ({})),
      setup: vi.fn(),
    },
  };
});

describe('bootstrap (main.ts)', () => {
  it('crea la app habilitando cors, pipes y docs, y escucha en :3000', async () => {
    const { bootstrap } = await import('./main.js');

    await bootstrap();

    expect(appStub.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: true, credentials: true }),
    );
    expect(appStub.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(appStub.listen).toHaveBeenCalledWith(3000);
  }, 15000);
});
