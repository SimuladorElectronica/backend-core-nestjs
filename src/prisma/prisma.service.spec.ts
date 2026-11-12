import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    // prisma no intenta conectarse hasta $connect; un url cualquiera alcanza
    process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db?schema=public';
    service = new PrismaService();
    vi.spyOn(service, '$connect').mockResolvedValue(undefined as never);
    vi.spyOn(service, '$disconnect').mockResolvedValue(undefined as never);
  });

  it('onModuleInit conecta el cliente', async () => {
    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy desconecta el cliente', async () => {
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});
