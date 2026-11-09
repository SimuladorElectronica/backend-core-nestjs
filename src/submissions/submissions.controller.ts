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
import { SubmissionsService } from './submissions.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { UpdateSubmissionDto } from './dto/update-submission.dto.js';
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
      'El docente lista las entregas de sus guías; el alumno, solo las suyas.',
  })
  @ApiOkResponse({ description: 'Entregas del usuario, más recientes primero' })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.submissionsService.findAll(req.user);
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
