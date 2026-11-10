import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { LibrariesService } from './libraries.service.js';
import { CreateLibraryDto } from './dto/create-library.dto.js';
import { UpdateLibraryDto } from './dto/update-library.dto.js';
import { ListLibrariesQueryDto } from './dto/list-libraries-query.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';

@ApiTags('Libraries')
@Controller('libraries')
export class LibrariesController {
  constructor(private readonly librariesService: LibrariesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar las librerías C++ curadas',
    description:
      'Público. Admite `?q=` para buscar por nombre o autor y `?take=`/`?skip=` ' +
      'para paginar. El total de coincidencias se devuelve en `X-Total-Count`.',
  })
  @ApiHeader({
    name: 'X-Total-Count',
    description: 'Total de librerías que cumplen el filtro',
  })
  @ApiOkResponse({ description: 'Listado público de librerías' })
  async findAll(
    @Query() query: ListLibrariesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total } = await this.librariesService.findAll(query);
    res.setHeader('X-Total-Count', total);
    return items;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una librería curada por su UUID' })
  @ApiOkResponse({ description: 'Librería encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.librariesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Crear una librería curada (solo rol ADMIN)' })
  @ApiCreatedResponse({ description: 'Librería creada' })
  create(@Body() dto: CreateLibraryDto) {
    return this.librariesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Actualizar una librería curada (solo rol ADMIN)',
  })
  @ApiOkResponse({ description: 'Librería actualizada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryDto,
  ) {
    return this.librariesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eliminar una librería curada (solo rol ADMIN)' })
  @ApiOkResponse({ description: 'Librería eliminada' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.librariesService.remove(id);
  }
}
