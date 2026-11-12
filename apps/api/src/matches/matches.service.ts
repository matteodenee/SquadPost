import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  MatchLocation,
  MatchStatus,
  MembershipStatus,
  type Prisma,
} from '../generated/prisma/client.js';

const MATCH_INCLUDE = {
  opponent: true,
  season: { include: { competition: { include: { sportFormat: { include: { sport: true } } } } } },
};

type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof MATCH_INCLUDE }>;

interface OpponentInput {
  name?: unknown;
  shortName?: unknown;
  primaryColor?: unknown;
  secondaryColor?: unknown;
}

interface MatchInput {
  seasonId?: unknown;
  opponentId?: unknown;
  round?: unknown;
  scheduledAt?: unknown;
  venue?: unknown;
  location?: unknown;
  clubScore?: unknown;
  opponentScore?: unknown;
}

@Injectable()
export class MatchesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listOpponents(actorId: string, clubId: string) {
    await this.requireManagedClub(actorId, clubId);
    const opponents = await this.prisma.opponent.findMany({
      where: { clubId },
      orderBy: [{ inactiveAt: 'asc' }, { name: 'asc' }],
    });
    return { opponents: opponents.map((opponent) => this.toOpponent(opponent)) };
  }

  async createOpponent(actorId: string, clubId: string, input: OpponentInput) {
    await this.requireManagedClub(actorId, clubId);
    const data = this.opponentData(input, true);
    const opponent = await this.prisma.opponent.create({
      data: {
        clubId,
        name: data.name!,
        shortName: data.shortName!,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
      },
    });
    return { opponent: this.toOpponent(opponent) };
  }

  async updateOpponent(actorId: string, clubId: string, opponentId: string, input: OpponentInput) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireOpponent(clubId, opponentId, false);
    const data = this.opponentData(input, false);
    if (!Object.keys(data).length) throw new BadRequestException('Aucune information à modifier.');
    const opponent = await this.prisma.opponent.update({ where: { id: opponentId }, data });
    return { opponent: this.toOpponent(opponent) };
  }

  async changeOpponentStatus(
    actorId: string,
    clubId: string,
    opponentId: string,
    activeValue: unknown,
  ) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireOpponent(clubId, opponentId, false);
    const active = this.boolean(activeValue);
    const opponent = await this.prisma.opponent.update({
      where: { id: opponentId },
      data: { inactiveAt: active ? null : new Date() },
    });
    return { opponent: this.toOpponent(opponent) };
  }

  async listMatches(actorId: string, clubId: string) {
    await this.requireManagedClub(actorId, clubId);
    const matches = await this.prisma.match.findMany({
      where: { clubId },
      include: MATCH_INCLUDE,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });
    return { matches: matches.map((match) => this.toMatch(match)) };
  }

  async createMatch(actorId: string, clubId: string, input: MatchInput) {
    await this.requireManagedClub(actorId, clubId);
    const season = await this.requireSeason(clubId, input.seasonId, true);
    const opponent = await this.requireOpponent(clubId, input.opponentId, true);
    const data = this.matchData(input, true);
    const match = await this.prisma.match.create({
      data: {
        clubId,
        seasonId: season.id,
        opponentId: opponent.id,
        round: data.round,
        scheduledAt: data.scheduledAt,
        venue: data.venue,
        location: data.location,
        clubScore: data.clubScore,
        opponentScore: data.opponentScore,
        snapshotStarterCount: season.competition.starterCount,
        snapshotFinisherCount: season.competition.finisherCount,
        snapshotSportName: season.competition.sportFormat.sport.name,
        snapshotFormatName: season.competition.sportFormat.name,
      },
      include: MATCH_INCLUDE,
    });
    return { match: this.toMatch(match) };
  }

  async updateMatch(actorId: string, clubId: string, matchId: string, input: MatchInput) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireMatch(clubId, matchId);
    const data: Record<string, unknown> = this.matchData(input, false);
    if (input.opponentId !== undefined)
      data.opponentId = (await this.requireOpponent(clubId, input.opponentId, true)).id;
    if (input.seasonId !== undefined) {
      const season = await this.requireSeason(clubId, input.seasonId, true);
      Object.assign(data, {
        seasonId: season.id,
        snapshotStarterCount: season.competition.starterCount,
        snapshotFinisherCount: season.competition.finisherCount,
        snapshotSportName: season.competition.sportFormat.sport.name,
        snapshotFormatName: season.competition.sportFormat.name,
      });
    }
    if (!Object.keys(data).length) throw new BadRequestException('Aucune information à modifier.');
    const match = await this.prisma.match.update({
      where: { id: matchId },
      data,
      include: MATCH_INCLUDE,
    });
    return { match: this.toMatch(match) };
  }

  async changeMatchStatus(actorId: string, clubId: string, matchId: string, statusValue: unknown) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireMatch(clubId, matchId);
    if (
      typeof statusValue !== 'string' ||
      !Object.values(MatchStatus).includes(statusValue as MatchStatus)
    ) {
      throw new BadRequestException('Le statut du match est invalide.');
    }
    const match = await this.prisma.match.update({
      where: { id: matchId },
      data: { status: statusValue as MatchStatus },
      include: MATCH_INCLUDE,
    });
    return { match: this.toMatch(match) };
  }

  private opponentData(input: OpponentInput, creating: boolean) {
    const data: {
      name?: string;
      shortName?: string;
      primaryColor?: string | null;
      secondaryColor?: string | null;
    } = {};
    if (creating || input.name !== undefined)
      data.name = this.requiredText(input.name, "Le nom de l'adversaire", 120);
    if (creating || input.shortName !== undefined)
      data.shortName = this.requiredText(input.shortName, 'Le nom court', 30);
    if (input.primaryColor !== undefined)
      data.primaryColor = this.color(input.primaryColor, 'La couleur principale');
    if (input.secondaryColor !== undefined)
      data.secondaryColor = this.color(input.secondaryColor, 'La couleur secondaire');
    return data;
  }

  private matchData(input: MatchInput, creating: boolean) {
    const data: {
      round?: string | null;
      scheduledAt?: Date | null;
      venue?: string | null;
      location?: MatchLocation | null;
      clubScore?: number | null;
      opponentScore?: number | null;
    } = {};
    if (input.round !== undefined) data.round = this.optionalText(input.round, 'La journée', 80);
    if (input.scheduledAt !== undefined) data.scheduledAt = this.dateTime(input.scheduledAt);
    if (input.venue !== undefined) data.venue = this.optionalText(input.venue, 'Le lieu', 160);
    if (input.location !== undefined) data.location = this.location(input.location);
    if (input.clubScore !== undefined)
      data.clubScore = this.score(input.clubScore, 'Le score du club');
    if (input.opponentScore !== undefined) {
      data.opponentScore = this.score(input.opponentScore, 'Le score adverse');
    }
    if (creating && input.seasonId === undefined)
      throw new BadRequestException('La saison est obligatoire.');
    if (creating && input.opponentId === undefined)
      throw new BadRequestException("L'adversaire est obligatoire.");
    return data;
  }

  private async requireManagedClub(actorId: string, clubId: string) {
    this.uuid(clubId, "L'identifiant du club");
    const membership = await this.prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId: actorId, clubId } },
    });
    if (membership?.status !== MembershipStatus.ACTIVE)
      throw new ForbiddenException("Vous n'avez pas accès aux matchs de ce club.");
  }

  private async requireOpponent(clubId: string, value: unknown, active: boolean) {
    if (typeof value !== 'string') throw new BadRequestException("L'adversaire est obligatoire.");
    this.uuid(value, "L'identifiant de l'adversaire");
    const opponent = await this.prisma.opponent.findFirst({
      where: { id: value, clubId, ...(active ? { inactiveAt: null } : {}) },
    });
    if (!opponent) throw new NotFoundException('Adversaire introuvable dans ce club.');
    return opponent;
  }

  private async requireSeason(clubId: string, value: unknown, active: boolean) {
    if (typeof value !== 'string') throw new BadRequestException('La saison est obligatoire.');
    this.uuid(value, "L'identifiant de la saison");
    const season = await this.prisma.season.findFirst({
      where: {
        id: value,
        competition: { clubId, ...(active ? { inactiveAt: null } : {}) },
        ...(active ? { inactiveAt: null } : {}),
      },
      include: { competition: { include: { sportFormat: { include: { sport: true } } } } },
    });
    if (!season) throw new NotFoundException('Saison active introuvable dans ce club.');
    return season;
  }

  private async requireMatch(clubId: string, matchId: string) {
    this.uuid(matchId, "L'identifiant du match");
    const match = await this.prisma.match.findFirst({ where: { id: matchId, clubId } });
    if (!match) throw new NotFoundException('Match introuvable dans ce club.');
    return match;
  }

  private requiredText(value: unknown, label: string, max: number) {
    if (typeof value !== 'string') throw new BadRequestException(`${label} est obligatoire.`);
    const text = value.trim();
    if (!text || text.length > max)
      throw new BadRequestException(`${label} doit contenir entre 1 et ${max} caractères.`);
    return text;
  }

  private optionalText(value: unknown, label: string, max: number) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || value.trim().length > max)
      throw new BadRequestException(`${label} est invalide.`);
    return value.trim() || null;
  }

  private color(value: unknown, label: string) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !/^#[0-9A-F]{6}$/i.test(value))
      throw new BadRequestException(`${label} doit être au format #RRGGBB.`);
    return value.toUpperCase();
  }

  private dateTime(value: unknown) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string')
      throw new BadRequestException('La date et l’heure sont invalides.');
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('La date et l’heure sont invalides.');
    return date;
  }

  private location(value: unknown) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !Object.values(MatchLocation).includes(value as MatchLocation))
      throw new BadRequestException('Le lieu sportif est invalide.');
    return value as MatchLocation;
  }

  private score(value: unknown, label: string) {
    if (value === null || value === '') return null;
    const score = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(score) || score < 0 || score > 999) {
      throw new BadRequestException(`${label} doit être un entier entre 0 et 999.`);
    }
    return score;
  }

  private boolean(value: unknown) {
    if (typeof value !== 'boolean')
      throw new BadRequestException('Le statut actif doit être un booléen.');
    return value;
  }

  private uuid(value: string, label: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw new BadRequestException(`${label} est invalide.`);
  }

  private toOpponent(opponent: {
    id: string;
    clubId: string;
    name: string;
    shortName: string;
    primaryColor: string | null;
    secondaryColor: string | null;
    inactiveAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: opponent.id,
      clubId: opponent.clubId,
      name: opponent.name,
      shortName: opponent.shortName,
      primaryColor: opponent.primaryColor,
      secondaryColor: opponent.secondaryColor,
      active: opponent.inactiveAt === null,
      createdAt: opponent.createdAt,
      updatedAt: opponent.updatedAt,
    };
  }

  private toMatch(match: MatchWithRelations) {
    return {
      id: match.id,
      clubId: match.clubId,
      round: match.round,
      scheduledAt: match.scheduledAt,
      venue: match.venue,
      location: match.location,
      status: match.status,
      starterCount: match.snapshotStarterCount,
      finisherCount: match.snapshotFinisherCount,
      sportName: match.snapshotSportName,
      formatName: match.snapshotFormatName,
      clubScore: match.clubScore,
      opponentScore: match.opponentScore,
      opponent: this.toOpponent(match.opponent),
      season: {
        id: match.season.id,
        label: match.season.label,
        competition: { id: match.season.competition.id, name: match.season.competition.name },
      },
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }
}
