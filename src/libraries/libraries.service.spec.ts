import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LibrariesService } from './libraries.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLibraryDto } from './dto/create-library.dto.js';

const dto: CreateLibraryDto = {
  name: 'LiquidCrystal_I2C',
  headerFile: 'LiquidCrystal_I2C.h',
  author: 'Marcos Breuer',
  description: 'Pantallas LCD con interface I2C',
  version: '1.0.0',
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

describe('LibrariesService', () => {
  let service: LibrariesService;
  let prisma: {
    curatedLibrary: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      curatedLibrary: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new LibrariesService(prisma as unknown as PrismaService);
  });

  it('crea una librería curada', async () => {
    prisma.curatedLibrary.create.mockResolvedValue({
      id: 'lib-1',
      ...dto,
    });

    const result = await service.create(dto);

    expect(result.id).toBe('lib-1');
    expect(prisma.curatedLibrary.create).toHaveBeenCalledWith({
      data: dto,
    });
  });

  it('retorna 409 si el nombre ya existe', async () => {
    prisma.curatedLibrary.create.mockRejectedValue(uniqueViolation());

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('lanza 404 al buscar una librería inexistente', async () => {
    prisma.curatedLibrary.findUnique.mockResolvedValue(null);

    await expect(service.findOne('faltante')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('actualiza una librería existente', async () => {
    prisma.curatedLibrary.findUnique.mockResolvedValue({
      id: 'lib-1',
      ...dto,
    });
    prisma.curatedLibrary.update.mockResolvedValue({
      id: 'lib-1',
      ...dto,
      version: '2.0.0',
    });

    const result = await service.update('lib-1', { version: '2.0.0' });

    expect(result.version).toBe('2.0.0');
    expect(prisma.curatedLibrary.update).toHaveBeenCalledWith({
      where: { id: 'lib-1' },
      data: { version: '2.0.0' },
    });
  });

  it('elimina una librería existente', async () => {
    prisma.curatedLibrary.findUnique.mockResolvedValue({
      id: 'lib-1',
      ...dto,
    });
    prisma.curatedLibrary.delete.mockResolvedValue({ id: 'lib-1' });

    const result = await service.remove('lib-1');

    expect(result.id).toBe('lib-1');
    expect(prisma.curatedLibrary.delete).toHaveBeenCalledWith({
      where: { id: 'lib-1' },
    });
  });
});
