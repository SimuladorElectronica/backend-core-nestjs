import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  ProjectsReadController,
  ProjectsWriteController,
} from './controllers/projects.controller.js';
import { ProjectsService } from './services/projects.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [ProjectsReadController, ProjectsWriteController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
