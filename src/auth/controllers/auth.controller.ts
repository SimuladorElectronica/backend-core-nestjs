import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service.js';
import { RegisterDto } from '../dto/register.dto.js';
import { LoginDto } from '../dto/login.dto.js';
import { auth, info } from '../../common/decorators/auth.js';
import { currentUser } from '../../common/decorators/current-user.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @info('registrar un nuevo usuario')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @info('iniciar sesión y obtener un token bearer')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @auth(undefined, 'obtener el perfil del usuario autenticado')
  getProfile(@currentUser() user: { id: string }) {
    return user;
  }
}
