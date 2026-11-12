import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  ClassroomsMembershipController,
  ClassroomsReadController,
  ClassroomsWriteController,
} from './controllers/classrooms.controller.js';
import { ClassroomsService } from './services/classrooms.service.js';
import { ClassroomAccessService } from './services/classroom-access.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [
    ClassroomsReadController,
    ClassroomsWriteController,
    ClassroomsMembershipController,
  ],
  providers: [ClassroomsService, ClassroomAccessService],
  exports: [ClassroomsService, ClassroomAccessService],
})
export class ClassroomsModule {}
