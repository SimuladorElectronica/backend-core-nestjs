import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  SubmissionsReadController,
  SubmissionsWriteController,
} from './controllers/submissions.controller.js';
import { SubmissionsService } from './services/submissions.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [SubmissionsReadController, SubmissionsWriteController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
