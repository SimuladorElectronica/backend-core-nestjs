import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
  const TARGET_ID = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('promueve a un usuario y retorna solo id, email, name y role', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: TARGET_ID });
    prisma.user.update.mockResolvedValue({
      id: TARGET_ID,
      email: 'alumno@test.com',
      name: 'Alumno',
      role: Role.TEACHER,
    });

    const result = await service.updateRole(
      TARGET_ID,
      { role: Role.TEACHER },
      ADMIN_ID,
    );

    expect(result).toEqual({
      id: TARGET_ID,
      email: 'alumno@test.com',
      name: 'Alumno',
      role: Role.TEACHER,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { role: Role.TEACHER },
      select: { id: true, email: true, name: true, role: true },
    });
  });

  it('lanza 404 si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.updateRole(TARGET_ID, { role: Role.TEACHER }, ADMIN_ID),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('lanza 403 si un admin intenta cambiar su propio rol', async () => {
    await expect(
      service.updateRole(ADMIN_ID, { role: Role.STUDENT }, ADMIN_ID),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
