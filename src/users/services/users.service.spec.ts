import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { UsersService } from './users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
  const TARGET_ID = '22222222-2222-4222-8222-222222222222';
  const PUBLIC_SELECT = { id: true, email: true, name: true, role: true };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('lista usuarios con filtros, paginaciÃ³n y sin passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: TARGET_ID, email: 'a@b.com', name: 'A', role: Role.STUDENT },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({
        role: Role.STUDENT,
        search: 'a@b',
        take: 5,
        skip: 0,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: Role.STUDENT,
          OR: [
            { name: { contains: 'a@b', mode: 'insensitive' } },
            { email: { contains: 'a@b', mode: 'insensitive' } },
          ],
        },
        select: { id: true, email: true, name: true, role: true, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        skip: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('usa la paginaciÃ³n por defecto', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0, where: {} }),
      );
    });
  });

  describe('findOne', () => {
    it('retorna el usuario sin passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: TARGET_ID,
        email: 'alumno@test.com',
        name: 'Alumno',
        role: Role.STUDENT,
        isActive: true,
      });

      const result = await service.findOne(TARGET_ID);

      expect(result).not.toHaveProperty('passwordHash');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        select: { ...PUBLIC_SELECT, isActive: true },
      });
    });

    it('lanza 404 si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(TARGET_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRole', () => {
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
        select: PUBLIC_SELECT,
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

  describe('updateMe', () => {
    it('actualiza solo los campos enviados', async () => {
      prisma.user.update.mockResolvedValue({
        id: TARGET_ID,
        email: 'alumno@test.com',
        name: 'Alumno Nuevo',
        role: Role.STUDENT,
      });

      await service.updateMe(TARGET_ID, { name: 'Alumno Nuevo' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { name: 'Alumno Nuevo' },
        select: PUBLIC_SELECT,
      });
    });

    it('lanza 409 si el email ya estÃ¡ registrado', async () => {
      prisma.user.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.updateMe(TARGET_ID, { email: 'tomado@test.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('rechaza la contraseÃ±a actual incorrecta', async () => {
      const passwordHash = await argon2.hash('Correcta123!', {
        type: argon2.argon2id,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: TARGET_ID,
        passwordHash,
      });

      await expect(
        service.changePassword(TARGET_ID, {
          currentPassword: 'Incorrecta123!',
          newPassword: 'Nueva123456!',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('guarda la nueva contraseÃ±a con Argon2id', async () => {
      const passwordHash = await argon2.hash('Correcta123!', {
        type: argon2.argon2id,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: TARGET_ID,
        passwordHash,
      });
      prisma.user.update.mockResolvedValue({ id: TARGET_ID });

      const result = await service.changePassword(TARGET_ID, {
        currentPassword: 'Correcta123!',
        newPassword: 'Nueva123456!',
      });

      expect(result).toEqual({ message: 'contraseña actualizada' });
      const [[call]] = prisma.user.update.mock.calls as [
        [{ where: { id: string }; data: { passwordHash: string } }],
      ];
      expect(call.where).toEqual({ id: TARGET_ID });
      expect(call.data.passwordHash).not.toBe('Nueva123456!');
      await expect(
        argon2.verify(call.data.passwordHash, 'Nueva123456!'),
      ).resolves.toBe(true);
    });
  });

  describe('deactivate', () => {
    it('marca la cuenta como inactiva', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: TARGET_ID });
      prisma.user.update.mockResolvedValue({ id: TARGET_ID });

      const result = await service.deactivate(TARGET_ID, ADMIN_ID);

      expect(result).toEqual({ message: 'usuario desactivado', id: TARGET_ID });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { isActive: false },
      });
    });

    it('lanza 404 si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivate(TARGET_ID, ADMIN_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('lanza 403 si el admin intenta desactivarse a sÃ­ mismo', async () => {
      await expect(service.deactivate(ADMIN_ID, ADMIN_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
