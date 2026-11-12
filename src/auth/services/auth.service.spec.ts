import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../dto/register.dto.js';
import { LoginDto } from '../dto/login.dto.js';

vi.mock('argon2', () => ({
  default: undefined, // el import `* as argon2` resolve las named exports
  hash: vi.fn(async () => 'hashed'),
  verify: vi.fn(async () => true),
  argon2id: 2,
}));

const registerDto: RegisterDto = {
  name: 'alumno',
  email: 'alumno@test.com',
  password: 'password_segura',
};

const loginDto: LoginDto = {
  email: 'alumno@test.com',
  password: 'password_segura',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      user: { findUnique: vi.fn(), create: vi.fn() },
    };
    jwt = { signAsync: vi.fn(async () => 'token-falso') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('rechaza (409) si el correo ya está registrado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('crea el usuario con argon2id y retorna el token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u-1', email: registerDto.email });

      const result = await service.register(registerDto);

      expect(argon2.hash).toHaveBeenCalledWith(registerDto.password, { type: 2 });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ passwordHash: 'hashed', email: registerDto.email }),
      });
      expect(result.access_token).toBe('token-falso');
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u-1', email: registerDto.email });
    });
  });

  describe('login', () => {
    it('rechaza (401) si las credenciales son inválidas (usuario inexistente)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza (401) si la cuenta está desactivada', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', isActive: false });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza (401) si la contraseña no coincide', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', isActive: true, passwordHash: 'h' });
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('retorna el token cuando las credenciales son válidas', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: loginDto.email,
        isActive: true,
        passwordHash: 'hashed-stored',
      });

      const result = await service.login(loginDto);

      expect(argon2.verify).toHaveBeenCalledWith('hashed-stored', loginDto.password);
      expect(result.access_token).toBe('token-falso');
    });
  });
});
