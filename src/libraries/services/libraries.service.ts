import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notFound, conflict } from '../../common/errors.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { CreateLibraryDto } from '../dto/create-library.dto.js';
import { UpdateLibraryDto } from '../dto/update-library.dto.js';
import { ListLibrariesQueryDto } from '../dto/list-libraries-query.dto.js';
import { resolvePagination } from '../../common/dto/pagination-query.dto.js';

type libraryWhereInput = Prisma.CuratedLibraryWhereInput;

@Injectable()
export class LibrariesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLibraryDto) {
    try {
      return await this.prisma.curatedLibrary.create({ data: dto });
    } catch (error) {
      rethrowUniqueViolation(error, dto.name);
      throw error;
    }
  }

  async findAll(query: ListLibrariesQueryDto = {}) {
    const where: libraryWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { author: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const { take, skip } = resolvePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.curatedLibrary.findMany({
        where,
        orderBy: { name: 'asc' },
        take,
        skip,
      }),
      this.prisma.curatedLibrary.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string) {
    const library = await this.prisma.curatedLibrary.findUnique({
      where: { id },
    });

    if (!library) {
      throw notFound(`no existe la librería "${id}"`);
    }

    return library;
  }

  async update(id: string, dto: UpdateLibraryDto) {
    await this.findOne(id);

    try {
      return await this.prisma.curatedLibrary.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      rethrowUniqueViolation(error, dto.name);
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.curatedLibrary.delete({ where: { id } });

    return { message: 'librería eliminada', id };
  }

}

/** `name` tiene índice único: 409 en lugar de un 500 */
function rethrowUniqueViolation(error: unknown, name?: string) {
  if (isUniqueViolation(error)) {
    throw conflict(`ya existe una librería llamada "${name ?? ''}"`);
  }
}
