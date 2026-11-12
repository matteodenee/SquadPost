import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '../generated/prisma/client.js';
import type { RequestWithAuth } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { UserRoleGuard } from '../auth/user-role.guard.js';
import type { UploadedPhoto } from './media-storage.service.js';
import { PlayersService } from './players.service.js';

const uploadLimit = Number(process.env.PLAYER_PHOTO_MAX_BYTES ?? 10 * 1024 * 1024);

@Controller('clubs/:clubId/players')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.COM_MANAGER)
export class PlayersController {
  constructor(@Inject(PlayersService) private readonly players: PlayersService) {}

  @Get()
  list(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Query('search') search?: string,
  ) {
    return this.players.list(request.auth!.id, clubId, search);
  }

  @Get(':playerId')
  get(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('playerId') playerId: string,
  ) {
    return this.players.get(request.auth!.id, clubId, playerId);
  }

  @Post()
  create(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.players.create(request.auth!.id, clubId, body);
  }

  @Patch(':playerId')
  update(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('playerId') playerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.players.update(request.auth!.id, clubId, playerId, body);
  }

  @Patch(':playerId/status')
  changeStatus(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('playerId') playerId: string,
    @Body('active') active: unknown,
  ) {
    return this.players.changeStatus(request.auth!.id, clubId, playerId, active);
  }

  @Post(':playerId/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: uploadLimit, files: 1 } }))
  replacePhoto(
    @Req() request: RequestWithAuth,
    @Param('clubId') clubId: string,
    @Param('playerId') playerId: string,
    @UploadedFile() file?: UploadedPhoto,
  ) {
    if (!file) throw new BadRequestException('Une photo JPG ou PNG est obligatoire.');
    return this.players.replacePhoto(request.auth!.id, clubId, playerId, file);
  }
}

@Controller('me/player-profiles')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.PLAYER)
export class MyPlayerProfilesController {
  constructor(@Inject(PlayersService) private readonly players: PlayersService) {}

  @Get()
  list(@Req() request: RequestWithAuth) {
    return this.players.listOwn(request.auth!.id);
  }
}

@Controller('player-profiles')
@UseGuards(SessionAuthGuard, UserRoleGuard)
@Roles(UserRole.PLAYER, UserRole.COM_MANAGER)
export class PlayerPhotosController {
  constructor(@Inject(PlayersService) private readonly players: PlayersService) {}

  @Get(':playerId/photo')
  async photo(
    @Req() request: RequestWithAuth,
    @Param('playerId') playerId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const photo = await this.players.readPhoto(
      { id: request.auth!.id, role: request.auth!.role },
      playerId,
    );
    response.setHeader('Content-Type', photo.mimeType);
    response.setHeader('Content-Length', String(photo.sizeBytes));
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(photo.buffer);
  }
}
