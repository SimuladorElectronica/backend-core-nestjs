import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
