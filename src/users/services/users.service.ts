import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notFound, forbidden, conflict, badRequest } from '../../common/errors.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { UpdateMeDto } from '../dto/update-me.dto.js';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { ListUsersQueryDto } from '../dto/list-users-query.dto.js';
import { resolvePagination } from '../../common/dto/pagination-query.dto.js';

type userWhereInput = Prisma.UserWhereInput;
type userUpdateInput = Prisma.UserUpdateInput;

/** campos públicos de un usuario: nunca el passwordHash */
const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

/** vista de administración: agrega el estado de la cuenta */
const userAdminSelect = {
  ...userSelect,
  isActive: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** directorio de usuarios (solo admin), con filtros por rol y texto */
  async findAll(query: ListUsersQueryDto = {}) {
    const where: userWhereInput = {};

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
        select: userAdminSelect,
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
      select: userAdminSelect,
    });

    if (!user) {
      throw notFound(`no existe el usuario "${id}"`);
    }

    return user;
  }

  async updateRole(id: string, dto: UpdateRoleDto, requesterId: string) {
    if (id === requesterId) {
      throw forbidden('un administrador no puede cambiar su propio rol');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw notFound(`no existe el usuario "${id}"`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: userSelect,
    });
  }

  /** el propio usuario actualiza su nombre y/o email */
  async updateMe(id: string, dto: UpdateMeDto) {
    const data: userUpdateInput = {};

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
        select: userSelect,
      });
    } catch (error) {
      this.rethrowUniqueViolation(error);
      throw error;
    }
  }

  /** cambio de contraseña verificando la actual (argon2id) */
  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw notFound(`no existe el usuario "${id}"`);
    }

    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);

    if (!isValid) {
      throw badRequest('la contraseña actual no es correcta');
    }

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'contraseña actualizada' };
  }

  /**
   * baja lógica: el usuario deja de poder iniciar sesión y sus tokens
   * dejan de ser válidos (jwtStrategy valida `isActive`)
   */
  async deactivate(id: string, requesterId: string) {
    if (id === requesterId) {
      throw forbidden('un administrador no puede desactivar su propia cuenta');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw notFound(`no existe el usuario "${id}"`);
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'usuario desactivado', id };
  }

  /** `email` tiene índice único: 409 en lugar de un 500 */
  private rethrowUniqueViolation(error: unknown) {
    if (isUniqueViolation(error)) {
      throw conflict('el correo ya está registrado');
    }
  }
}
