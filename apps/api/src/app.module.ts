import { Module } from '@nestjs/common';
import { AdminUsersModule } from './admin-users/admin-users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule, AdminUsersModule],
  controllers: [HealthController],
})
export class AppModule {}
