import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GuidesController } from './guides.controller.js';
import { GuidesService } from './guides.service.js';

@Module({
  // AuthModule exporta JwtModule, necesario para resolver los guards JWT
  imports: [AuthModule],
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
