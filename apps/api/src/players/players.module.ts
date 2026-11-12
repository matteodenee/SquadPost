import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaStorageService } from './media-storage.service.js';
import {
  MyPlayerProfilesController,
  PlayerPhotosController,
  PlayersController,
} from './players.controller.js';
import { PlayersService } from './players.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PlayersController, MyPlayerProfilesController, PlayerPhotosController],
  providers: [PlayersService, MediaStorageService],
})
export class PlayersModule {}
