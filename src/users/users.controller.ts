import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { UsersService } from './users.service.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; name: string; role: Role };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Listar usuarios (solo rol ADMIN)',
    description:
      'Directorio de usuarios con filtros por rol y búsqueda por nombre o email. ' +
      'Nunca expone el passwordHash.',
  })
  @ApiHeader({
    name: 'X-Total-Count',
    description: 'Total de usuarios que cumplen los filtros',
  })
  @ApiOkResponse({ description: 'Usuarios encontrados' })
  @ApiResponse({ status: 401, description: 'Sin token o token inválido' })
  @ApiResponse({ status: 403, description: 'Rol no permitido' })
  async findAll(
    @Query() query: ListUsersQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total } = await this.usersService.findAll(query);
    res.setHeader('X-Total-Count', total);
    return items;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Obtener un usuario por UUID (solo rol ADMIN)' })
  @ApiOkResponse({ description: 'Usuario encontrado' })
  @ApiResponse({ status: 400, description: 'UUID inválido' })
  @ApiResponse({ status: 401, description: 'Sin token o token inválido' })
  @ApiResponse({ status: 403, description: 'Rol no permitido' })
  @ApiResponse({ status: 404, description: 'Usuario inexistente' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Actualizar el propio perfil (requiere sesión)',
    description:
      'Permite cambiar el nombre y/o el email del usuario autenticado.',
  })
  @ApiOkResponse({ description: 'Perfil actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'Sin token o token inválido' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  updateMe(@Body() dto: UpdateMeDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.updateMe(req.user.id, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Cambiar la propia contraseña (requiere sesión)',
    description:
      'Verifica la contraseña actual y guarda la nueva con Argon2id.',
  })
  @ApiOkResponse({ description: 'Contraseña actualizada' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta o datos inválidos' })
  @ApiResponse({ status: 401, description: 'Sin token o token inválido' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.changePassword(req.user.id, dto);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cambiar el rol de un usuario (solo rol ADMIN)',
    description:
      'Promueve o degrada a un usuario a ADMIN, TEACHER o STUDENT. ' +
      'Un admin no puede cambiar su propio rol (403) para no quedarse sin admins.',
  })
  @ApiResponse({ status: 200, description: 'Rol actualizado' })
  @ApiResponse({ status: 400, description: 'UUID inválido o rol inválido' })
  @ApiResponse({ status: 401, description: 'Sin token o token inválido' })
  @ApiResponse({
    status: 403,
    description: 'Rol no permitido o auto-cambio de rol',
  })
  @ApiResponse({ status: 404, description: 'Usuario inexistente' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateRole(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desactivar un usuario (solo rol ADMIN)',
    description:
      'Baja lógica: marca `isActive = false`. El usuario no puede volver a ' +
      'iniciar sesión y sus tokens dejan de ser válidos. Un admin no puede ' +
      'desactivarse a sí mismo (403).',
  })
  @ApiOkResponse({ description: 'Usuario desactivado' })
  @ApiResponse({ status: 400, description: 'UUID inválido' })
  @ApiResponse({ status: 401, description: 'Sin token o token inválido' })
  @ApiResponse({
    status: 403,
    description: 'Rol no permitido o intento de auto-desactivarse',
  })
  @ApiResponse({ status: 404, description: 'Usuario inexistente' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.deactivate(id, req.user.id);
  }
}
