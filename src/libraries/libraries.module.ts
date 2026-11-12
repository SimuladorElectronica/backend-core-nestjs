import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  LibrariesReadController,
  LibrariesWriteController,
} from './controllers/libraries.controller.js';
import { LibrariesService } from './services/libraries.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [LibrariesReadController, LibrariesWriteController],
  providers: [LibrariesService],
  exports: [LibrariesService],
})
export class LibrariesModule {}
