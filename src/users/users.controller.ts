import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { UsersService } from './users.service.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: Role };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @ApiResponse({ status: 403, description: 'Rol no permitido o auto-cambio de rol' })
  @ApiResponse({ status: 404, description: 'Usuario inexistente' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateRole(id, dto, req.user.id);
  }
}
