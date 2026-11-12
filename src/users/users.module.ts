import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  UsersReadController,
  UsersWriteController,
} from './controllers/users.controller.js';
import { UsersService } from './services/users.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [UsersReadController, UsersWriteController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
