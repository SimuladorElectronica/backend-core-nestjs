import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLibraryDto } from './dto/create-library.dto.js';
import { UpdateLibraryDto } from './dto/update-library.dto.js';

@Injectable()
export class LibrariesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLibraryDto) {
    try {
      return await this.prisma.curatedLibrary.create({ data: dto });
    } catch (error) {
      this.rethrowUniqueViolation(error, dto.name);
      throw error;
    }
  }

  findAll() {
    return this.prisma.curatedLibrary.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const library = await this.prisma.curatedLibrary.findUnique({
      where: { id },
    });

    if (!library) {
      throw new NotFoundException(`No existe la librería "${id}"`);
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
      this.rethrowUniqueViolation(error, dto.name);
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.curatedLibrary.delete({ where: { id } });

    return { message: 'Librería eliminada', id };
  }

  /** `name` tiene índice único: 409 en lugar de un 500 */
  private rethrowUniqueViolation(error: unknown, name?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        `Ya existe una librería llamada "${name ?? ''}"`,
      );
    }
  }
}
