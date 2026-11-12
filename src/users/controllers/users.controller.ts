import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from '../services/users.service.js';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { UpdateMeDto } from '../dto/update-me.dto.js';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { ListUsersQueryDto } from '../dto/list-users-query.dto.js';
import { auth } from '../../common/decorators/auth.js';
import { currentUser, uuidParam } from '../../common/decorators/current-user.js';
import { setTotalCount, type totalCountHeader } from '../../common/total-count.js';

@ApiTags('users')
@Controller('users')
export class UsersReadController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @auth('admin', 'listar usuarios (solo admin, nunca expone passwordHash)')
  async findAll(
    @Query() query: ListUsersQueryDto,
    @Res({ passthrough: true }) res: totalCountHeader,
  ) {
    const { items, total } = await this.usersService.findAll(query);
    setTotalCount(res, total);
    return items;
  }

  @Get(':id')
  @auth('admin', 'obtener un usuario por uuid (solo admin)')
  findOne(@uuidParam() id: string) {
    return this.usersService.findOne(id);
  }
}

@ApiTags('users')
@Controller('users')
export class UsersWriteController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @auth(undefined, 'actualizar el propio perfil')
  updateMe(@Body() dto: UpdateMeDto, @currentUser() user: { id: string }) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Patch('me/password')
  @auth(undefined, 'cambiar la contraseña propia')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @currentUser() user: { id: string },
  ) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Patch(':id/role')
  @auth('admin', 'cambiar el rol de un usuario (solo admin)')
  updateRole(
    @uuidParam() id: string,
    @Body() dto: UpdateRoleDto,
    @currentUser() user: { id: string },
  ) {
    return this.usersService.updateRole(id, dto, user.id);
  }

  @Delete(':id')
  @auth('admin', 'desactivar un usuario (solo admin)')
  deactivate(@uuidParam() id: string, @currentUser() user: { id: string }) {
    return this.usersService.deactivate(id, user.id);
  }
}
