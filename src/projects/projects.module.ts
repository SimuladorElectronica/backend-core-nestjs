import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  ProjectsDeleteController,
  ProjectsReadController,
  ProjectsTemplateController,
  ProjectsWriteController,
} from './controllers/projects.controller.js';
import { ProjectsService } from './services/projects.service.js';
import { ProjectTemplatesService } from './services/project-templates.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [
    ProjectsReadController,
    ProjectsWriteController,
    ProjectsTemplateController,
    ProjectsDeleteController,
  ],
  providers: [ProjectsService, ProjectTemplatesService],
  exports: [ProjectsService, ProjectTemplatesService],
})
export class ProjectsModule {}
