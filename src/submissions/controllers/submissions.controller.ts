import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { SubmissionsService } from '../services/submissions.service.js';
import { CreateSubmissionDto } from '../dto/create-submission.dto.js';
import { UpdateSubmissionDto } from '../dto/update-submission.dto.js';
import { ListSubmissionsQueryDto } from '../dto/list-submissions-query.dto.js';
import { auth } from '../../common/decorators/auth.js';
import { currentUser, uuidParam } from '../../common/decorators/current-user.js';
import { setTotalCount, type totalCountHeader } from '../../common/total-count.js';

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsReadController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  @auth(undefined, 'listar entregas según el rol del usuario')
  async findAll(
    @currentUser() user: { id: string; role: Role },
    @Query() query: ListSubmissionsQueryDto,
    @Res({ passthrough: true }) res: totalCountHeader,
  ) {
    const { items, total } = await this.submissionsService.findAll(
      user,
      query,
    );
    setTotalCount(res, total);
    return items;
  }

  @Get(':id')
  @auth(undefined, 'obtener una entrega por su uuid')
  findOne(
    @uuidParam() id: string,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.submissionsService.findOne(id, user);
  }
}

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsWriteController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @auth(undefined, 'entregar un proyecto propio a una guía')
  create(
    @Body() dto: CreateSubmissionDto,
    @currentUser() user: { id: string },
  ) {
    return this.submissionsService.create(dto, user.id);
  }

  @Put(':id')
  @auth(undefined, 'reemplazar el proyecto entregado')
  update(
    @uuidParam() id: string,
    @Body() dto: UpdateSubmissionDto,
    @currentUser() user: { id: string },
  ) {
    return this.submissionsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @auth(undefined, 'retirar una entrega propia')
  remove(@uuidParam() id: string, @currentUser() user: { id: string }) {
    return this.submissionsService.remove(id, user.id);
  }
}
