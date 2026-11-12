import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    process.env.JWT_SECRET ??= 'test-secret';
    prisma = { user: { findUnique: vi.fn() } };
    strategy = new JwtStrategy(prisma as unknown as PrismaService);
  });

  it('retorna la identidad del payload para un usuario activo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'a@test.com',
      name: 'Ana',
      role: 'ADMIN',
      isActive: true,
    });

    const result = await strategy.validate({ sub: 'u-1', email: 'a@test.com' });

    expect(result).toEqual({ id: 'u-1', email: 'a@test.com', name: 'Ana', role: 'ADMIN' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-1' } });
  });

  it('rechaza (401) si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'ghost', email: 'x' })).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza (401) si la cuenta está desactivada', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'a@test.com',
      name: 'Ana',
      role: 'STUDENT',
      isActive: false,
    });

    await expect(strategy.validate({ sub: 'u-1', email: 'a@test.com' })).rejects.toThrow(UnauthorizedException);
  });
});
