import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  ClassroomsReadController,
  ClassroomsWriteController,
} from './controllers/classrooms.controller.js';
import { ClassroomsService } from './services/classrooms.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [ClassroomsReadController, ClassroomsWriteController],
  providers: [ClassroomsService],
  exports: [ClassroomsService],
})
export class ClassroomsModule {}
