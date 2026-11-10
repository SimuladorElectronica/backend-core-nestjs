import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

/** Solo estos campos se exponen: nunca el passwordHash */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
