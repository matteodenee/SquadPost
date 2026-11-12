import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { RequestWithAuth } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { UserRoleGuard } from '../auth/user-role.guard.js';
import { UserRole } from '../generated/prisma/client.js';
import { MatchesService } from './matches.service.js';

@Controller('clubs/:clubId/opponents')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.COM_MANAGER)
export class OpponentsController {
  constructor(@Inject(MatchesService) private readonly matches: MatchesService) {}

  @Get()
  list(@Req() request: RequestWithAuth, @Param('clubId') clubId: string) {
    return this.matches.listOpponents(request.auth!.id, clubId);
  }

  @Post()
  create(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.matches.createOpponent(request.auth!.id, clubId, body);
  }

  @Patch(':opponentId')
  update(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('opponentId') opponentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.matches.updateOpponent(request.auth!.id, clubId, opponentId, body);
  }

  @Patch(':opponentId/status')
  changeStatus(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('opponentId') opponentId: string,
    @Body('active') active: unknown,
  ) {
    return this.matches.changeOpponentStatus(request.auth!.id, clubId, opponentId, active);
  }
}

@Controller('clubs/:clubId/matches')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.COM_MANAGER)
export class MatchesController {
  constructor(@Inject(MatchesService) private readonly matches: MatchesService) {}

  @Get()
  list(@Req() request: RequestWithAuth, @Param('clubId') clubId: string) {
    return this.matches.listMatches(request.auth!.id, clubId);
  }

  @Post()
  create(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.matches.createMatch(request.auth!.id, clubId, body);
  }

  @Patch(':matchId')
  update(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('matchId') matchId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.matches.updateMatch(request.auth!.id, clubId, matchId, body);
  }

  @Patch(':matchId/status')
  changeStatus(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('matchId') matchId: string,
    @Body('status') status: unknown,
  ) {
    return this.matches.changeMatchStatus(request.auth!.id, clubId, matchId, status);
  }
}
