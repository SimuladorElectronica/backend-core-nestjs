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
  Req,
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
import type { Request, Response } from 'express';
import { SubmissionsService } from './submissions.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { UpdateSubmissionDto } from './dto/update-submission.dto.js';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: Role };
}

@ApiTags('Submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Entregar un proyecto propio a una guía (requiere sesión)',
    description:
      'Vincula el proyecto del alumno autenticado con la guía. El proyecto ' +
      'debe pertenecer al alumno que entrega (los anónimos o ajenos retornan 403).',
  })
  @ApiCreatedResponse({ description: 'Entrega registrada' })
  create(@Body() dto: CreateSubmissionDto, @Req() req: AuthenticatedRequest) {
    return this.submissionsService.create(dto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Listar entregas según el rol',
    description:
      'El docente lista las entregas de sus guías; el alumno, solo las suyas. ' +
      'Cada entrega incluye `guide` (id, title), `project` (id, title, shareSlug) ' +
      'y `student` (id, name, email). Admite `?guideId=` y paginación con ' +
      '`?take=`/`?skip=`; el total se devuelve en `X-Total-Count`.',
  })
  @ApiHeader({
    name: 'X-Total-Count',
    description: 'Total de entregas que cumplen el filtro',
  })
  @ApiOkResponse({
    description:
      'Entregas del usuario con datos del alumno, más recientes primero',
  })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListSubmissionsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total } = await this.submissionsService.findAll(
      req.user,
      query,
    );
    res.setHeader('X-Total-Count', total);
    return items;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Obtener una entrega por su UUID',
    description:
      'Visible solo para el alumno que entregó y para el docente de la guía.',
  })
  @ApiOkResponse({ description: 'Entrega encontrada' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.submissionsService.findOne(id, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Reemplazar el proyecto entregado (requiere sesión)',
    description:
      'Solo el alumno dueño de la entrega puede editarla, y el proyecto ' +
      'nuevo debe pertenecerle.',
  })
  @ApiOkResponse({ description: 'Entrega actualizada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.submissionsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Retirar una entrega propia (requiere sesión)',
  })
  @ApiOkResponse({ description: 'Entrega eliminada' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.submissionsService.remove(id, req.user.id);
  }
}
