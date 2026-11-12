import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  GuidesReadController,
  GuidesWriteController,
} from './controllers/guides.controller.js';
import { GuidesService } from './services/guides.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [GuidesReadController, GuidesWriteController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
