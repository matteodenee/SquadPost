import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { MembershipStatus } from '../generated/prisma/client.js';

const COMPETITION_INCLUDE = {
  sportFormat: { include: { sport: true } },
  seasons: { orderBy: [{ inactiveAt: 'asc' as const }, { startDate: 'desc' as const }] },
};

interface CompetitionInput {
  name?: unknown;
  sportFormatId?: unknown;
  starterCount?: unknown;
  finisherCount?: unknown;
}

interface SeasonInput {
  label?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

@Injectable()
export class CompetitionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSportFormats() {
    const formats = await this.prisma.sportFormat.findMany({
      include: { sport: true },
      orderBy: [{ sport: { name: 'asc' } }, { defaultStarterCount: 'asc' }],
    });
    return { formats: formats.map((format) => this.toSportFormat(format)) };
  }

  async list(actorId: string, clubId: string) {
    await this.requireManagedClub(actorId, clubId);
    const competitions = await this.prisma.competition.findMany({
      where: { clubId },
      include: COMPETITION_INCLUDE,
      orderBy: [{ inactiveAt: 'asc' }, { name: 'asc' }],
    });
    return { competitions: competitions.map((competition) => this.toCompetition(competition)) };
  }

  async create(actorId: string, clubId: string, input: CompetitionInput) {
    await this.requireManagedClub(actorId, clubId);
    const name = this.requiredText(input.name, 'Le nom de la compétition', 120);
    const format = await this.requireSportFormat(input.sportFormatId);
    const starterCount = this.count(
      input.starterCount,
      'Le nombre de titulaires',
      1,
      format.defaultStarterCount,
    );
    const finisherCount = this.count(
      input.finisherCount,
      'Le nombre de finisseurs',
      0,
      format.defaultFinisherCount,
    );
    const competition = await this.prisma.competition.create({
      data: { clubId, sportFormatId: format.id, name, starterCount, finisherCount },
      include: COMPETITION_INCLUDE,
    });
    return { competition: this.toCompetition(competition) };
  }

  async update(actorId: string, clubId: string, competitionId: string, input: CompetitionInput) {
    await this.requireManagedClub(actorId, clubId);
    const existing = await this.requireCompetition(clubId, competitionId);
    const data: {
      name?: string;
      sportFormatId?: string;
      starterCount?: number;
      finisherCount?: number;
    } = {};
    let format = existing.sportFormat;
    if (input.name !== undefined) data.name = this.requiredText(input.name, 'Le nom', 120);
    if (input.sportFormatId !== undefined) {
      format = await this.requireSportFormat(input.sportFormatId);
      data.sportFormatId = format.id;
    }
    if (input.starterCount !== undefined || data.sportFormatId) {
      data.starterCount = this.count(
        input.starterCount,
        'Le nombre de titulaires',
        1,
        format.defaultStarterCount,
      );
    }
    if (input.finisherCount !== undefined || data.sportFormatId) {
      data.finisherCount = this.count(
        input.finisherCount,
        'Le nombre de finisseurs',
        0,
        format.defaultFinisherCount,
      );
    }
    if (!Object.keys(data).length) throw new BadRequestException('Aucune information à modifier.');
    const competition = await this.prisma.competition.update({
      where: { id: competitionId },
      data,
      include: COMPETITION_INCLUDE,
    });
    return { competition: this.toCompetition(competition) };
  }

  async changeStatus(actorId: string, clubId: string, competitionId: string, activeValue: unknown) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireCompetition(clubId, competitionId);
    const active = this.boolean(activeValue);
    const competition = await this.prisma.competition.update({
      where: { id: competitionId },
      data: { inactiveAt: active ? null : new Date() },
      include: COMPETITION_INCLUDE,
    });
    return { competition: this.toCompetition(competition) };
  }

  async createSeason(actorId: string, clubId: string, competitionId: string, input: SeasonInput) {
    await this.requireManagedClub(actorId, clubId);
    await this.requireCompetition(clubId, competitionId);
    const data = this.seasonData(input, true);
    try {
      const season = await this.prisma.season.create({
        data: {
          competitionId,
          label: data.label!,
          startDate: data.startDate,
          endDate: data.endDate,
        },
      });
      return { season: this.toSeason(season) };
    } catch (error) {
      this.rethrowSeasonConflict(error);
      throw error;
    }
  }

  async updateSeason(
    actorId: string,
    clubId: string,
    competitionId: string,
    seasonId: string,
    input: SeasonInput,
  ) {
    await this.requireManagedClub(actorId, clubId);
    const competition = await this.requireCompetition(clubId, competitionId);
    const existing = competition.seasons.find((season) => season.id === seasonId);
    if (!existing) throw new NotFoundException('Saison introuvable dans cette compétition.');
    const data = this.seasonData(input, false, existing);
    if (!Object.keys(data).length) throw new BadRequestException('Aucune information à modifier.');
    try {
      const season = await this.prisma.season.update({ where: { id: seasonId }, data });
      return { season: this.toSeason(season) };
    } catch (error) {
      this.rethrowSeasonConflict(error);
      throw error;
    }
  }

  async changeSeasonStatus(
    actorId: string,
    clubId: string,
    competitionId: string,
    seasonId: string,
    activeValue: unknown,
  ) {
    await this.requireManagedClub(actorId, clubId);
    const competition = await this.requireCompetition(clubId, competitionId);
    if (!competition.seasons.some((season) => season.id === seasonId)) {
      throw new NotFoundException('Saison introuvable dans cette compétition.');
    }
    const active = this.boolean(activeValue);
    const season = await this.prisma.season.update({
      where: { id: seasonId },
      data: { inactiveAt: active ? null : new Date() },
    });
    return { season: this.toSeason(season) };
  }

  private async requireManagedClub(actorId: string, clubId: string) {
    this.uuid(clubId, "L'identifiant du club");
    const membership = await this.prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId: actorId, clubId } },
    });
    if (membership?.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException("Vous n'avez pas accès aux compétitions de ce club.");
    }
  }

  private async requireCompetition(clubId: string, competitionId: string) {
    this.uuid(competitionId, "L'identifiant de la compétition");
    const competition = await this.prisma.competition.findFirst({
      where: { id: competitionId, clubId },
      include: COMPETITION_INCLUDE,
    });
    if (!competition) throw new NotFoundException('Compétition introuvable dans ce club.');
    return competition;
  }

  private async requireSportFormat(value: unknown) {
    if (typeof value !== 'string')
      throw new BadRequestException('Le format sportif est obligatoire.');
    this.uuid(value, "L'identifiant du format");
    const format = await this.prisma.sportFormat.findUnique({
      where: { id: value },
      include: { sport: true },
    });
    if (!format) throw new BadRequestException("Le format sportif n'est pas disponible.");
    return format;
  }

  private seasonData(
    input: SeasonInput,
    creating: boolean,
    existing?: { label: string; startDate: Date | null; endDate: Date | null },
  ) {
    const data: { label?: string; startDate?: Date | null; endDate?: Date | null } = {};
    if (creating || input.label !== undefined) {
      data.label = this.requiredText(input.label, 'Le libellé de la saison', 80);
    }
    if (input.startDate !== undefined)
      data.startDate = this.date(input.startDate, 'La date de début');
    if (input.endDate !== undefined) data.endDate = this.date(input.endDate, 'La date de fin');
    const startDate = data.startDate !== undefined ? data.startDate : existing?.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing?.endDate;
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début.');
    }
    return data;
  }

  private requiredText(value: unknown, label: string, max: number) {
    if (typeof value !== 'string') throw new BadRequestException(`${label} est obligatoire.`);
    const normalized = value.trim();
    if (!normalized || normalized.length > max) {
      throw new BadRequestException(`${label} doit contenir entre 1 et ${max} caractères.`);
    }
    return normalized;
  }

  private count(value: unknown, label: string, minimum: number, fallback: number) {
    const normalized = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(normalized) || normalized < minimum || normalized > 100) {
      throw new BadRequestException(`${label} doit être un entier entre ${minimum} et 100.`);
    }
    return normalized;
  }

  private date(value: unknown, label: string): Date | null {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} doit être au format AAAA-MM-JJ.`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${label} est invalide.`);
    }
    return parsed;
  }

  private boolean(value: unknown) {
    if (typeof value !== 'boolean')
      throw new BadRequestException('Le statut actif doit être un booléen.');
    return value;
  }

  private uuid(value: string, label: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException(`${label} est invalide.`);
    }
  }

  private rethrowSeasonConflict(error: unknown): never | void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException(
        'Une saison portant ce libellé existe déjà pour cette compétition.',
      );
    }
  }

  private toSportFormat(format: {
    id: string;
    code: string;
    name: string;
    defaultStarterCount: number;
    defaultFinisherCount: number;
    sport: { id: string; code: string; name: string };
  }) {
    return {
      id: format.id,
      code: format.code,
      name: format.name,
      defaultStarterCount: format.defaultStarterCount,
      defaultFinisherCount: format.defaultFinisherCount,
      sport: format.sport,
    };
  }

  private toSeason(season: {
    id: string;
    label: string;
    startDate: Date | null;
    endDate: Date | null;
    inactiveAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: season.id,
      label: season.label,
      startDate: season.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: season.endDate?.toISOString().slice(0, 10) ?? null,
      active: season.inactiveAt === null,
      createdAt: season.createdAt,
      updatedAt: season.updatedAt,
    };
  }

  private toCompetition(competition: {
    id: string;
    clubId: string;
    name: string;
    starterCount: number;
    finisherCount: number;
    inactiveAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    sportFormat: Parameters<CompetitionsService['toSportFormat']>[0];
    seasons: Parameters<CompetitionsService['toSeason']>[0][];
  }) {
    return {
      id: competition.id,
      clubId: competition.clubId,
      name: competition.name,
      starterCount: competition.starterCount,
      finisherCount: competition.finisherCount,
      active: competition.inactiveAt === null,
      createdAt: competition.createdAt,
      updatedAt: competition.updatedAt,
      sportFormat: this.toSportFormat(competition.sportFormat),
      seasons: competition.seasons.map((season) => this.toSeason(season)),
    };
  }
}
