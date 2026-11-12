import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompetitionsController, SportFormatsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CompetitionsController, SportFormatsController],
  providers: [CompetitionsService],
})
export class CompetitionsModule {}
