import { Prisma } from '@prisma/client';
import { withUniqueCode } from './unique-code.js';

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

describe('withUniqueCode', () => {
  it('devuelve el resultado del primer intento con un código de 6 caracteres', async () => {
    const fn = vi.fn(async (code: string) => code);

    await expect(withUniqueCode(fn)).resolves.toMatch(/^[a-z0-9]{6}$/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta ante una colisión y devuelve el segundo resultado', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce('segundo');

    await expect(withUniqueCode(fn)).resolves.toBe('segundo');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('repropaga la colisión después de agotar los intentos', async () => {
    const fn = vi.fn().mockRejectedValue(uniqueViolation());

    await expect(withUniqueCode(fn)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('no reintenta errores que no son de unicidad', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withUniqueCode(fn)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
