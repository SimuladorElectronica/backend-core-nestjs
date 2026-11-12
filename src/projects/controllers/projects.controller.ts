import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { ProjectsService } from '../services/projects.service.js';
import { CreateProjectDto } from '../dto/create-project.dto.js';
import { UpdateProjectDto } from '../dto/update-project.dto.js';
import { SetTemplateDto } from '../dto/set-template.dto.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { auth, info, optionalAuth } from '../../common/decorators/auth.js';
import {
  currentUser,
  routeParam,
  uuidParam,
} from '../../common/decorators/current-user.js';
import { setTotalCount, type totalCountHeader } from '../../common/total-count.js';

@ApiTags('projects')
@Controller('projects')
export class ProjectsReadController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @optionalAuth('listar proyectos propios o recientes públicos')
  async list(
    @currentUser() user: { id: string } | null,
    @Query() query: PaginationQueryDto,
    @Res({ passthrough: true }) res: totalCountHeader,
  ) {
    const { items, total } = await this.projectsService.list(
      user?.id ?? null,
      query,
    );
    setTotalCount(res, total);
    return items;
  }

  // rutas literales de plantillas antes de `:key` para que no caigan en findByKey
  @Get('templates')
  @info('listar las plantillas públicas del simulador (sin sesión)')
  listTemplates() {
    return this.projectsService.listTemplates();
  }

  @Get('templates/:slug')
  @info('obtener una plantilla pública por su slug (sin sesión)')
  findTemplate(@routeParam('slug') slug: string) {
    return this.projectsService.findTemplateBySlug(slug);
  }

  @Get(':key')
  @optionalAuth('obtener por shareSlug o uuid (público o dueño)')
  findOne(
    @routeParam('key') key: string,
    @currentUser() user: { id: string } | null,
  ) {
    return this.projectsService.findByKey(key, user?.id ?? null);
  }
}

@ApiTags('projects')
@Controller('projects')
export class ProjectsWriteController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @optionalAuth('guardar un esquemático (anónimo o autenticado)')
  create(
    @Body() dto: CreateProjectDto,
    @currentUser() user: { id: string } | null,
  ) {
    return this.projectsService.create(dto, user?.id ?? null);
  }

  @Put(':id')
  @auth(undefined, 'actualizar un proyecto propio (requiere sesión)')
  update(
    @uuidParam() id: string,
    @Body() dto: UpdateProjectDto,
    @currentUser() user: { id: string },
  ) {
    return this.projectsService.update(id, dto, user.id);
  }

  @Patch(':id/template')
  @auth(
    undefined,
    'marcar o desmarcar un proyecto como plantilla (admin o teacher dueño)',
  )
  setTemplate(
    @uuidParam() id: string,
    @Body() dto: SetTemplateDto,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.projectsService.setTemplate(id, dto.isTemplate, user);
  }

  @Delete(':id')
  @auth(undefined, 'eliminar un proyecto propio (requiere sesión)')
  remove(@uuidParam() id: string, @currentUser() user: { id: string }) {
    return this.projectsService.remove(id, user.id);
  }
}
