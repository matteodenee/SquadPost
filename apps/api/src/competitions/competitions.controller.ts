import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { RequestWithAuth } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { UserRoleGuard } from '../auth/user-role.guard.js';
import { UserRole } from '../generated/prisma/client.js';
import { CompetitionsService } from './competitions.service.js';

@Controller('sport-formats')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.COM_MANAGER)
export class SportFormatsController {
  constructor(@Inject(CompetitionsService) private readonly competitions: CompetitionsService) {}

  @Get()
  list() {
    return this.competitions.listSportFormats();
  }
}

@Controller('clubs/:clubId/competitions')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.COM_MANAGER)
export class CompetitionsController {
  constructor(@Inject(CompetitionsService) private readonly competitions: CompetitionsService) {}

  @Get()
  list(@Req() request: RequestWithAuth, @Param('clubId') clubId: string) {
    return this.competitions.list(request.auth!.id, clubId);
  }

  @Post()
  create(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.competitions.create(request.auth!.id, clubId, body);
  }

  @Patch(':competitionId')
  update(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('competitionId') competitionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.competitions.update(request.auth!.id, clubId, competitionId, body);
  }

  @Patch(':competitionId/status')
  changeStatus(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('competitionId') competitionId: string,
    @Body('active') active: unknown,
  ) {
    return this.competitions.changeStatus(request.auth!.id, clubId, competitionId, active);
  }

  @Post(':competitionId/seasons')
  createSeason(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('competitionId') competitionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.competitions.createSeason(request.auth!.id, clubId, competitionId, body);
  }

  @Patch(':competitionId/seasons/:seasonId')
  updateSeason(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('competitionId') competitionId: string,
    @Param('seasonId') seasonId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.competitions.updateSeason(request.auth!.id, clubId, competitionId, seasonId, body);
  }

  @Patch(':competitionId/seasons/:seasonId/status')
  changeSeasonStatus(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('competitionId') competitionId: string,
    @Param('seasonId') seasonId: string,
    @Body('active') active: unknown,
  ) {
    return this.competitions.changeSeasonStatus(
      request.auth!.id,
      clubId,
      competitionId,
      seasonId,
      active,
    );
  }
}
