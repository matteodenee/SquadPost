import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { UserRoleGuard } from './user-role.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, UserRoleGuard],
  exports: [AuthService, SessionAuthGuard, UserRoleGuard],
})
export class AuthModule {}
