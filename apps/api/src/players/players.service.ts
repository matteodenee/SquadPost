import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { MediaStorageService, type UploadedPhoto } from './media-storage.service.js';

const PLAYER_INCLUDE = { compositionPhoto: true } as const;

interface PlayerInput {
  firstName?: unknown;
  lastName?: unknown;
  primaryPosition?: unknown;
  usualJerseyNumber?: unknown;
  userId?: unknown;
}

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  async list(actorId: string, clubId: string, searchValue: unknown) {
    await this.requireManagedClub(actorId, clubId);
    const search = this.validateSearch(searchValue);
    const players = await this.prisma.clubPlayer.findMany({
      where: {
        clubId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
                { primaryPosition: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: PLAYER_INCLUDE,
      orderBy: [{ inactiveAt: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });
    return { players: players.map((player) => this.toPlayer(player)) };
  }

  async get(actorId: string, clubId: string, playerId: string) {
    await this.requireManagedClub(actorId, clubId);
    const player = await this.requireClubPlayer(clubId, playerId);
    return { player: this.toPlayer(player) };
  }

  async create(actorId: string, clubId: string, input: PlayerInput) {
    await this.requireManagedClub(actorId, clubId);
    const data = await this.validatePlayerInput(clubId, input, true);
    try {
      const player = await this.prisma.clubPlayer.create({
        data: {
          clubId,
          firstName: data.firstName!,
          lastName: data.lastName!,
          primaryPosition: data.primaryPosition,
          usualJerseyNumber: data.usualJerseyNumber,
          userId: data.userId,
        },
        include: PLAYER_INCLUDE,
      });
      return { player: this.toPlayer(player) };
    } catch (error) {
      this.rethrowKnownDatabaseError(error);
      throw error;
    }
  }

  async update(actorId: string, clubId: string, playerId: string, input: PlayerInput) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireClubPlayer(clubId, playerId);
    const data = await this.validatePlayerInput(clubId, input, false);
    if (!Object.keys(data).length) throw new BadRequestException('Aucune information à modifier.');

    try {
      const player = await this.prisma.clubPlayer.update({
        where: { id: playerId },
        data,
        include: PLAYER_INCLUDE,
      });
      return { player: this.toPlayer(player) };
    } catch (error) {
      this.rethrowKnownDatabaseError(error);
      throw error;
    }
  }

  async changeStatus(actorId: string, clubId: string, playerId: string, activeValue: unknown) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireClubPlayer(clubId, playerId);
    if (typeof activeValue !== 'boolean') {
      throw new BadRequestException('Le statut actif doit être un booléen.');
    }
    const player = await this.prisma.clubPlayer.update({
      where: { id: playerId },
      data: { inactiveAt: activeValue ? null : new Date() },
      include: PLAYER_INCLUDE,
    });
    return { player: this.toPlayer(player) };
  }

  async replacePhoto(actorId: string, clubId: string, playerId: string, file: UploadedPhoto) {
    await this.requireManagedClub(actorId, clubId);
    const existingPlayer = await this.requireClubPlayer(clubId, playerId);
    const stored = await this.storage.storePlayerPhoto(clubId, playerId, file);

    let player;
    try {
      player = await this.prisma.$transaction(async (transaction) => {
        const asset = await transaction.mediaAsset.create({ data: { clubId, ...stored } });
        const updatedPlayer = await transaction.clubPlayer.update({
          where: { id: playerId },
          data: { compositionPhotoId: asset.id },
          include: PLAYER_INCLUDE,
        });
        if (existingPlayer.compositionPhoto) {
          await transaction.mediaAsset.delete({
            where: { id: existingPlayer.compositionPhoto.id },
          });
        }
        return updatedPlayer;
      });
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }

    if (existingPlayer.compositionPhoto) {
      await this.storage.remove(existingPlayer.compositionPhoto.storageKey).catch((error) => {
        this.logger.warn(
          `Ancienne photo non supprimée (${existingPlayer.compositionPhoto!.storageKey})`,
          error,
        );
      });
    }
    return { player: this.toPlayer(player) };
  }

  async listOwn(userId: string) {
    const players = await this.prisma.clubPlayer.findMany({
      where: {
        userId,
        club: { memberships: { some: { userId, status: MembershipStatus.ACTIVE } } },
      },
      include: { ...PLAYER_INCLUDE, club: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      players: players.map((player) => ({
        ...this.toPlayer(player),
        club: { id: player.club.id, name: player.club.name, shortName: player.club.shortName },
      })),
    };
  }

  async readPhoto(
    actor: { id: string; role: UserRole },
    playerId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
    this.validateUuid(playerId, "L'identifiant du joueur");
    const player = await this.prisma.clubPlayer.findUnique({
      where: { id: playerId },
      include: PLAYER_INCLUDE,
    });
    if (!player || !player.compositionPhoto) throw new NotFoundException('Photo introuvable.');

    if (actor.role === UserRole.COM_MANAGER) {
      await this.requireManagedClub(actor.id, player.clubId);
    } else if (actor.role === UserRole.PLAYER) {
      if (player.userId !== actor.id) {
        throw new ForbiddenException("Vous n'avez pas accès à cette photo.");
      }
      const membership = await this.prisma.clubMembership.findUnique({
        where: { userId_clubId: { userId: actor.id, clubId: player.clubId } },
      });
      if (membership?.status !== MembershipStatus.ACTIVE) {
        throw new ForbiddenException("Vous n'avez pas accès à cette photo.");
      }
    } else {
      throw new ForbiddenException("Votre rôle ne permet pas d'accéder à cette photo.");
    }

    return {
      buffer: await this.storage.read(player.compositionPhoto.storageKey),
      mimeType: player.compositionPhoto.mimeType,
      sizeBytes: player.compositionPhoto.sizeBytes,
    };
  }

  private async requireManagedClub(actorId: string, clubId: string) {
    this.validateUuid(clubId, "L'identifiant du club");
    const membership = await this.prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId: actorId, clubId } },
    });
    if (membership?.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException("Vous n'avez pas accès à l'effectif de ce club.");
    }
  }

  private async requireClubPlayer(clubId: string, playerId: string) {
    this.validateUuid(playerId, "L'identifiant du joueur");
    const player = await this.prisma.clubPlayer.findFirst({
      where: { id: playerId, clubId },
      include: PLAYER_INCLUDE,
    });
    if (!player) throw new NotFoundException('Joueur introuvable dans ce club.');
    return player;
  }

  private async validatePlayerInput(clubId: string, input: PlayerInput, creating: boolean) {
    const data: {
      firstName?: string;
      lastName?: string;
      primaryPosition?: string | null;
      usualJerseyNumber?: number | null;
      userId?: string | null;
    } = {};

    if (creating || input.firstName !== undefined) {
      data.firstName = this.validateRequiredText(input.firstName, 'Le prénom', 80);
    }
    if (creating || input.lastName !== undefined) {
      data.lastName = this.validateRequiredText(input.lastName, 'Le nom', 80);
    }
    if (input.primaryPosition !== undefined) {
      data.primaryPosition = this.validateOptionalText(
        input.primaryPosition,
        'Le poste principal',
        80,
      );
    }
    if (input.usualJerseyNumber !== undefined) {
      data.usualJerseyNumber = this.validateJerseyNumber(input.usualJerseyNumber);
    }
    if (input.userId !== undefined) {
      data.userId = await this.validateLinkedUser(clubId, input.userId);
    }
    return data;
  }

  private async validateLinkedUser(clubId: string, value: unknown): Promise<string | null> {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException('Le compte associé est invalide.');
    this.validateUuid(value, "L'identifiant du compte");
    const user = await this.prisma.user.findFirst({
      where: {
        id: value,
        role: UserRole.PLAYER,
        disabledAt: null,
        memberships: { some: { clubId, status: MembershipStatus.ACTIVE } },
      },
    });
    if (!user) {
      throw new BadRequestException(
        'Le compte associé doit être un PLAYER actif et membre de ce club.',
      );
    }
    return user.id;
  }

  private validateRequiredText(value: unknown, label: string, max: number) {
    if (typeof value !== 'string') throw new BadRequestException(`${label} est obligatoire.`);
    const normalized = value.trim();
    if (!normalized || normalized.length > max) {
      throw new BadRequestException(`${label} doit contenir entre 1 et ${max} caractères.`);
    }
    return normalized;
  }

  private validateOptionalText(value: unknown, label: string, max: number) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException(`${label} est invalide.`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) {
      throw new BadRequestException(`${label} ne peut pas dépasser ${max} caractères.`);
    }
    return normalized;
  }

  private validateJerseyNumber(value: unknown) {
    if (value === null || value === '') return null;
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 999) {
      throw new BadRequestException('Le numéro habituel doit être un entier entre 1 et 999.');
    }
    return number;
  }

  private validateSearch(value: unknown) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.trim().length > 100) {
      throw new BadRequestException('La recherche est invalide.');
    }
    return value.trim();
  }

  private validateUuid(value: string, label: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException(`${label} est invalide.`);
    }
  }

  private rethrowKnownDatabaseError(error: unknown): never | void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('Ce compte PLAYER possède déjà une fiche dans ce club.');
    }
  }

  private toPlayer(player: {
    id: string;
    clubId: string;
    userId: string | null;
    firstName: string;
    lastName: string;
    primaryPosition: string | null;
    usualJerseyNumber: number | null;
    inactiveAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    compositionPhoto: {
      id: string;
      mimeType: string;
      sizeBytes: number;
      width: number;
      height: number;
      hasAlpha: boolean;
    } | null;
  }) {
    return {
      id: player.id,
      clubId: player.clubId,
      userId: player.userId,
      firstName: player.firstName,
      lastName: player.lastName,
      primaryPosition: player.primaryPosition,
      usualJerseyNumber: player.usualJerseyNumber,
      active: player.inactiveAt === null,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
      compositionPhoto: player.compositionPhoto
        ? {
            mimeType: player.compositionPhoto.mimeType,
            sizeBytes: player.compositionPhoto.sizeBytes,
            width: player.compositionPhoto.width,
            height: player.compositionPhoto.height,
            hasAlpha: player.compositionPhoto.hasAlpha,
            url: `/api/player-profiles/${player.id}/photo?v=${player.updatedAt.getTime()}`,
          }
        : null,
    };
  }
}
