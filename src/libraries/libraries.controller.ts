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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { LibrariesService } from './libraries.service.js';
import { CreateLibraryDto } from './dto/create-library.dto.js';
import { UpdateLibraryDto } from './dto/update-library.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';

@ApiTags('Libraries')
@Controller('libraries')
export class LibrariesController {
  constructor(private readonly librariesService: LibrariesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las librerías C++ curadas' })
  @ApiOkResponse({ description: 'Listado público de librerías' })
  findAll() {
    return this.librariesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una librería curada por su UUID' })
  @ApiOkResponse({ description: 'Librería encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.librariesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Crear una librería curada (solo rol TEACHER)' })
  @ApiCreatedResponse({ description: 'Librería creada' })
  create(@Body() dto: CreateLibraryDto) {
    return this.librariesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Actualizar una librería curada (solo rol TEACHER)',
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
  @Roles(Role.TEACHER)
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eliminar una librería curada (solo rol TEACHER)' })
  @ApiOkResponse({ description: 'Librería eliminada' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.librariesService.remove(id);
  }
}
