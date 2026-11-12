import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { MembershipStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

const INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1_000;

interface CreateClubInput {
  name?: unknown;
  shortName?: unknown;
  primaryColor?: unknown;
  secondaryColor?: unknown;
  primarySportCode?: unknown;
}

@Injectable()
export class ClubsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.clubMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { club: { include: { primarySport: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return { clubs: memberships.map(({ club }) => this.toClub(club)) };
  }

  async create(userId: string, input: CreateClubInput) {
    const name = this.validateName(input.name, 'Le nom du club', 120);
    const shortName = this.validateName(input.shortName, 'Le nom court', 30);
    const primaryColor = this.validateColor(input.primaryColor, 'La couleur principale');
    const secondaryColor = this.validateColor(input.secondaryColor, 'La couleur secondaire');
    const primarySportCode = this.validateSportCode(input.primarySportCode);

    const club = await this.prisma.$transaction(async (transaction) => {
      const sport = await transaction.sport.findUnique({ where: { code: primarySportCode } });
      if (!sport) throw new BadRequestException("Le sport demandé n'est pas disponible.");

      const createdClub = await transaction.club.create({
        data: {
          name,
          shortName,
          primaryColor,
          secondaryColor,
          primarySportId: sport.id,
        },
        include: { primarySport: true },
      });
      await transaction.clubMembership.create({
        data: { clubId: createdClub.id, userId, status: MembershipStatus.ACTIVE },
      });
      return createdClub;
    });

    return { club: this.toClub(club) };
  }

  async listInvitations(userId: string, clubId: string) {
    await this.requireActiveMembership(userId, clubId);
    const invitations = await this.prisma.clubInvitation.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    });
    return { invitations: invitations.map((invitation) => this.toInvitation(invitation)) };
  }

  async createInvitation(userId: string, clubId: string, emailValue: unknown) {
    await this.requireActiveMembership(userId, clubId);
    const email = this.validateEmail(emailValue);

    const existingMembership = await this.prisma.clubMembership.findFirst({
      where: { clubId, status: MembershipStatus.ACTIVE, user: { email } },
    });
    if (existingMembership) {
      throw new ConflictException('Cet utilisateur est déjà membre actif du club.');
    }

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.clubInvitation.create({
      data: {
        clubId,
        email,
        tokenHash: this.hashToken(token),
        invitedById: userId,
        expiresAt: new Date(Date.now() + INVITATION_DURATION_MS),
      },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    });

    return { invitation: { ...this.toInvitation(invitation), token } };
  }

  async acceptInvitation(user: { id: string; email: string }, tokenValue: unknown) {
    const token = this.validateToken(tokenValue);
    const club = await this.prisma.$transaction(
      async (transaction) => {
        const invitation = await transaction.clubInvitation.findUnique({
          where: { tokenHash: this.hashToken(token) },
          include: { club: { include: { primarySport: true } } },
        });
        if (!invitation) throw new NotFoundException('Invitation introuvable ou invalide.');
        if (invitation.email !== user.email.trim().toLowerCase()) {
          throw new ForbiddenException("Cette invitation n'est pas destinée à votre compte.");
        }
        if (invitation.acceptedAt) {
          throw new ConflictException('Cette invitation a déjà été utilisée.');
        }
        if (invitation.expiresAt <= new Date()) {
          throw new ConflictException('Cette invitation a expiré.');
        }

        await transaction.clubMembership.upsert({
          where: { userId_clubId: { userId: user.id, clubId: invitation.clubId } },
          update: { status: MembershipStatus.ACTIVE },
          create: {
            userId: user.id,
            clubId: invitation.clubId,
            status: MembershipStatus.ACTIVE,
          },
        });
        await transaction.clubInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
        return invitation.club;
      },
      { isolationLevel: 'Serializable' },
    );

    return { club: this.toClub(club) };
  }

  private async requireActiveMembership(userId: string, clubId: string) {
    this.validateUuid(clubId);
    const membership = await this.prisma.clubMembership.findUnique({
      where: { userId_clubId: { userId, clubId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException("Vous n'avez pas accès à ce club.");
    }
  }

  private validateName(value: unknown, label: string, maxLength: number): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${label} est obligatoire.`);
    }
    const name = value.trim();
    if (!name || name.length > maxLength) {
      throw new BadRequestException(`${label} doit contenir entre 1 et ${maxLength} caractères.`);
    }
    return name;
  }

  private validateColor(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
      throw new BadRequestException(`${label} doit être au format hexadécimal #RRGGBB.`);
    }
    return value.toUpperCase();
  }

  private validateSportCode(value: unknown): string {
    if (value !== 'RUGBY') {
      throw new BadRequestException('Le sport principal doit être RUGBY pour cette version.');
    }
    return value;
  }

  private validateEmail(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Une adresse e-mail valide est obligatoire.');
    }
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Une adresse e-mail valide est obligatoire.');
    }
    return email;
  }

  private validateToken(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{40,100}$/.test(value)) {
      throw new BadRequestException("Le jeton d'invitation est invalide.");
    }
    return value;
  }

  private validateUuid(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException("L'identifiant du club est invalide.");
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private toClub(club: {
    id: string;
    name: string;
    shortName: string;
    primaryColor: string;
    secondaryColor: string;
    primarySport: { code: string; name: string };
  }) {
    return {
      id: club.id,
      name: club.name,
      shortName: club.shortName,
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      primarySport: club.primarySport,
    };
  }

  private toInvitation(invitation: {
    id: string;
    email: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      createdAt: invitation.createdAt,
      status: invitation.acceptedAt
        ? 'ACCEPTED'
        : invitation.expiresAt <= new Date()
          ? 'EXPIRED'
          : 'PENDING',
    };
  }
}
