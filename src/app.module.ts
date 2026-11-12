import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from "./auth/auth.module.js";
import { ProjectsModule } from './projects/projects.module.js';
import { LibrariesModule } from './libraries/libraries.module.js';
import { GuidesModule } from './guides/guides.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { UsersModule } from './users/users.module.js';
import { ClassroomsModule } from './classrooms/classrooms.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    LibrariesModule,
    GuidesModule,
    SubmissionsModule,
    UsersModule,
    ClassroomsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}