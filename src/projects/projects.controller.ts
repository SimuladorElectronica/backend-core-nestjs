import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

interface OptionalAuthRequest extends Request {
  user?: { id: string; email: string; role: Role };
}

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: Role };
}

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Guardar un esquemático (anónimo o autenticado) y obtener un shareSlug de 6 caracteres',
  })
  @ApiCreatedResponse({ description: 'Proyecto guardado con su enlace' })
  create(@Body() dto: CreateProjectDto, @Req() req: OptionalAuthRequest) {
    return this.projectsService.create(dto, req.user?.id ?? null);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Listar proyectos: los propios si hay token, o los públicos recientes si es anónimo',
  })
  @ApiOkResponse({ description: 'Hasta 20 proyectos ordenados por actividad' })
  list(@Req() req: OptionalAuthRequest) {
    return this.projectsService.list(req.user?.id ?? null);
  }

  @Get(':key')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Obtener un proyecto por shareSlug (6 caracteres, p. ej. "a9f3b2") o por UUID',
    description:
      'Si `key` tiene 6 caracteres se comporta como el enlace compartido: retorna ' +
      '`circuitData` (JSONB) y el código C++. Si es un UUID retorna el detalle completo ' +
      '(los proyectos privados solo los ve su dueño).',
  })
  @ApiParam({
    name: 'key',
    description: 'shareSlug de 6 caracteres o id UUID del proyecto',
    example: 'a9f3b2',
  })
  @ApiOkResponse({ description: 'Proyecto encontrado' })
  async findOne(@Param('key') key: string, @Req() req: OptionalAuthRequest) {
    if (this.projectsService.isShareSlug(key)) {
      return this.projectsService.findBySlug(key);
    }

    if (this.projectsService.isUuid(key)) {
      return this.projectsService.getById(key, req.user?.id ?? null);
    }

    throw new NotFoundException(
      `No existe un proyecto con el identificador "${key}"`,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Actualizar un proyecto propio (requiere sesión)' })
  @ApiOkResponse({ description: 'Proyecto actualizado' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eliminar un proyecto propio (requiere sesión)' })
  @ApiOkResponse({ description: 'Proyecto eliminado' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectsService.remove(id, req.user.id);
  }
}
