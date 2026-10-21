import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from "./auth/auth.module.js";
import { ProjectsModule } from './projects/projects.module.js';
import { LibrariesModule } from './libraries/libraries.module.js';
 
@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, LibrariesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}