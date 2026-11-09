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
  Req,
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
import { Request } from 'express';
import { GuidesService } from './guides.service.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';
import { UpdateGuideDto } from './dto/update-guide.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: Role };
}

@ApiTags('Guides')
@Controller('guides')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Crear una guía didáctica (solo rol TEACHER)',
    description:
      'Asocia la guía al docente autenticado y a un proyecto plantilla existente. ' +
      'Un usuario con rol STUDENT recibe 403 Forbidden.',
  })
  @ApiCreatedResponse({ description: 'Guía creada' })
  create(@Body() dto: CreateGuideDto, @Req() req: AuthenticatedRequest) {
    return this.guidesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar guías didácticas (más recientes primero)',
  })
  @ApiOkResponse({
    description: 'Listado de guías con su docente y proyecto plantilla',
  })
  findAll() {
    return this.guidesService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una guía por su UUID',
    description: 'Retorna instrucciones, docente y proyecto plantilla.',
  })
  @ApiOkResponse({ description: 'Guía encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.guidesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Actualizar una guía propia (solo rol TEACHER)',
    description:
      'El rol TEACHER no alcanza: la guía debe estar creada por el mismo ' +
      'docente autenticado, si no retorna 403.',
  })
  @ApiOkResponse({ description: 'Guía actualizada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuideDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.guidesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Eliminar una guía propia (solo rol TEACHER)',
    description:
      'Solo el docente dueño puede eliminarla; sus entregas se borran en ' +
      'cascada.',
  })
  @ApiOkResponse({ description: 'Guía eliminada' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.guidesService.remove(id, req.user.id);
  }
}
