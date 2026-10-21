import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LibrariesController } from './libraries.controller.js';
import { LibrariesService } from './libraries.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [LibrariesController],
  providers: [LibrariesService],
  exports: [LibrariesService],
})
export class LibrariesModule {}
