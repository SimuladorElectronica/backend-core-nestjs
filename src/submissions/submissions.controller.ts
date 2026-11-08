import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { SubmissionsService } from './submissions.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
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
}
