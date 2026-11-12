import { Body, Controller, Delete, Get, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { GuidesService } from '../services/guides.service.js';
import { CreateGuideDto } from '../dto/create-guide.dto.js';
import { UpdateGuideDto } from '../dto/update-guide.dto.js';
import { ListGuidesQueryDto } from '../dto/list-guides-query.dto.js';
import { auth } from '../../common/decorators/auth.js';
import { currentUser, uuidParam } from '../../common/decorators/current-user.js';

@ApiTags('guides')
@Controller('guides')
export class GuidesReadController {
  constructor(private readonly guidesService: GuidesService) {}

  @Get()
  @auth(undefined, 'listar guías según la inscripción del usuario (más recientes primero)')
  findAll(
    @Query() query: ListGuidesQueryDto,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.guidesService.findAll(query, user);
  }

  @Get(':id')
  @auth(undefined, 'obtener una guía (dueño, inscripto en el aula o admin)')
  findOne(
    @uuidParam() id: string,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.guidesService.findOne(id, user);
  }
}

@ApiTags('guides')
@Controller('guides')
export class GuidesWriteController {
  constructor(private readonly guidesService: GuidesService) {}

  @Post()
  @auth('teacher', 'crear guía didáctica (rol teacher)')
  create(@Body() dto: CreateGuideDto, @currentUser() user: { id: string }) {
    return this.guidesService.create(dto, user.id);
  }

  @Put(':id')
  @auth('teacher', 'actualizar una guía propia (rol teacher)')
  update(
    @uuidParam() id: string,
    @Body() dto: UpdateGuideDto,
    @currentUser() user: { id: string },
  ) {
    return this.guidesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @auth('teacher', 'eliminar una guía propia (rol teacher)')
  remove(@uuidParam() id: string, @currentUser() user: { id: string }) {
    return this.guidesService.remove(id, user.id);
  }
}
