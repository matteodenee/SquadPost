import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MatchesController, OpponentsController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OpponentsController, MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
