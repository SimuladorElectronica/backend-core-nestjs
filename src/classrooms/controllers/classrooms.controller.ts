import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { ClassroomsService } from '../services/classrooms.service.js';
import { CreateClassroomDto } from '../dto/create-classroom.dto.js';
import { JoinClassroomDto } from '../dto/join-classroom.dto.js';
import { auth } from '../../common/decorators/auth.js';
import { currentUser, uuidParam } from '../../common/decorators/current-user.js';

@ApiTags('classrooms')
@Controller('classrooms')
export class ClassroomsReadController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get()
  @auth(undefined, 'listar las aulas según el rol (docente: las crea; alumno: las que cursa)')
  findAll(@currentUser() user: { id: string; role: Role }) {
    return this.classroomsService.findAll(user);
  }

  @Get(':id')
  @auth(undefined, 'obtener un aula (solo dueño, inscriptos o admin)')
  findOne(
    @uuidParam() id: string,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.classroomsService.findOne(id, user);
  }

  @Get(':id/students')
  @auth(undefined, 'listar alumnos inscriptos (solo docente dueño o admin)')
  listStudents(
    @uuidParam() id: string,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.classroomsService.listStudents(id, user);
  }
}

@ApiTags('classrooms')
@Controller('classrooms')
export class ClassroomsWriteController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  @auth('teacher', 'crear un aula (rol teacher)')
  create(
    @Body() dto: CreateClassroomDto,
    @currentUser() user: { id: string },
  ) {
    return this.classroomsService.create(dto, user.id);
  }

  @Post('join')
  @auth('student', 'unirse a un aula con su código (rol student)')
  join(@Body() dto: JoinClassroomDto, @currentUser() user: { id: string }) {
    return this.classroomsService.join(dto.code, user.id);
  }
}

/**
 * Operaciones de administración del aula (código de unión, alumnos y borrado).
 * Se separa del alta/inscripción para mantener cada controlador con una
 * responsabilidad acotada.
 */
@ApiTags('classrooms')
@Controller('classrooms')
export class ClassroomsMembershipController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post(':id/regenerate-code')
  @auth(undefined, 'regenerar el código del aula (docente dueño o admin)')
  regenerateCode(
    @uuidParam() id: string,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.classroomsService.regenerateCode(id, user);
  }

  @Delete(':id/students/:studentId')
  @auth(undefined, 'quitar un alumno del aula (docente dueño, admin o el propio alumno)')
  removeMember(
    @uuidParam() id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.classroomsService.removeMember(id, studentId, user);
  }

  @Delete(':id')
  @auth(undefined, 'eliminar un aula sin guías (docente dueño o admin)')
  remove(
    @uuidParam() id: string,
    @currentUser() user: { id: string; role: Role },
  ) {
    return this.classroomsService.remove(id, user);
  }
}
