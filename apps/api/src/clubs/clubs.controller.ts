import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client.js';
import type { RequestWithAuth } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { UserRoleGuard } from '../auth/user-role.guard.js';
import { ClubsService } from './clubs.service.js';

@Controller('clubs')
@UseGuards(SessionAuthGuard, UserRoleGuard)
export class ClubsController {
  constructor(@Inject(ClubsService) private readonly clubs: ClubsService) {}

  @Get()
  @Roles(UserRole.PLAYER, UserRole.COM_MANAGER)
  list(@Req() request: RequestWithAuth) {
    return this.clubs.listForUser(request.auth!.id);
  }

  @Post()
  @Roles(UserRole.COM_MANAGER)
  create(@Req() request: RequestWithAuth, @Body() body: Record<string, unknown>) {
    return this.clubs.create(request.auth!.id, body);
  }

  @Get(':clubId/invitations')
  @Roles(UserRole.COM_MANAGER)
  listInvitations(@Req() request: RequestWithAuth, @Param('clubId') clubId: string) {
    return this.clubs.listInvitations(request.auth!.id, clubId);
  }

  @Post(':clubId/invitations')
  @Roles(UserRole.COM_MANAGER)
  createInvitation(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Body('email') email: unknown,
  ) {
    return this.clubs.createInvitation(request.auth!.id, clubId, email);
  }
}

@Controller('club-invitations')
@UseGuards(SessionAuthGuard, UserRoleGuard)
export class ClubInvitationsController {
  constructor(@Inject(ClubsService) private readonly clubs: ClubsService) {}

  @Post('accept')
  @Roles(UserRole.PLAYER, UserRole.COM_MANAGER)
  accept(@Req() request: RequestWithAuth, @Body('token') token: unknown) {
    return this.clubs.acceptInvitation({ id: request.auth!.id, email: request.auth!.email }, token);
  }
}
