import { Module } from '@nestjs/common';
import { AdminUsersModule } from './admin-users/admin-users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClubsModule } from './clubs/clubs.module.js';
import { DatabaseModule } from './database/database.module.js';
import { PlayersModule } from './players/players.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule, AdminUsersModule, ClubsModule, PlayersModule],
  controllers: [HealthController],
})
export class AppModule {}
