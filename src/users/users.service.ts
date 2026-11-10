import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { resolvePagination } from '../common/dto/pagination-query.dto.js';

/** Campos públicos de un usuario: nunca el passwordHash */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

/** Vista de administración: agrega el estado de la cuenta */
const USER_ADMIN_SELECT = {
  ...USER_SELECT,
  isActive: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Directorio de usuarios (solo ADMIN), con filtros por rol y texto */
  async findAll(query: ListUsersQueryDto = {}) {
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { take, skip } = resolvePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_ADMIN_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_ADMIN_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`No existe el usuario "${id}"`);
    }

    return user;
  }

  async updateRole(id: string, dto: UpdateRoleDto, requesterId: string) {
    if (id === requesterId) {
      throw new ForbiddenException(
        'Un administrador no puede cambiar su propio rol',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`No existe el usuario "${id}"`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: USER_SELECT,
    });
  }

  /** El propio usuario actualiza su nombre y/o email */
  async updateMe(id: string, dto: UpdateMeDto) {
    const data: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.email !== undefined) {
      data.email = dto.email;
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: USER_SELECT,
      });
    } catch (error) {
      this.rethrowUniqueViolation(error);
      throw error;
    }
  }

  /** Cambio de contraseña verificando la actual (Argon2id) */
  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException(`No existe el usuario "${id}"`);
    }

    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);

    if (!isValid) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada' };
  }

  /**
   * Baja lógica: el usuario deja de poder iniciar sesión y sus tokens
   * dejan de ser válidos (JwtStrategy valida `isActive`).
   */
  async deactivate(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new ForbiddenException(
        'Un administrador no puede desactivar su propia cuenta',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`No existe el usuario "${id}"`);
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Usuario desactivado', id };
  }

  /** `email` tiene índice único: 409 en lugar de un 500 */
  private rethrowUniqueViolation(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('El correo ya está registrado');
    }
  }
}
