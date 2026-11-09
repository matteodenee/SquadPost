import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client.js';
import { Roles } from '../auth/roles.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import type { RequestWithAuth } from '../auth/auth.types.js';
import { UserRoleGuard } from '../auth/user-role.guard.js';
import { AdminUsersService } from './admin-users.service.js';

@Controller('admin/users')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly users: AdminUsersService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.users.list(search);
  }

  @Get(':userId')
  get(@Param('userId') userId: string) {
    return this.users.get(userId);
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.users.create(body);
  }

  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() body: Record<string, unknown>) {
    return this.users.update(userId, body);
  }

  @Patch(':userId/role')
  changeRole(
    @Req() request: RequestWithAuth,
    @Param('userId') userId: string,
    @Body('role') role: unknown,
  ) {
    return this.users.changeRole(request.auth!.id, userId, role);
  }

  @Post(':userId/promote-admin')
  promoteToAdmin(
    @Req() request: RequestWithAuth,
    @Param('userId') userId: string,
    @Body('confirmation') confirmation: unknown,
  ) {
    return this.users.promoteToAdmin(request.auth!.id, userId, confirmation);
  }

  @Patch(':userId/status')
  changeStatus(
    @Req() request: RequestWithAuth,
    @Param('userId') userId: string,
    @Body('active') active: unknown,
  ) {
    return this.users.changeStatus(request.auth!.id, userId, active);
  }
}
