import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { MembershipStatus } from '../generated/prisma/client.js';
import { ClubsService } from './clubs.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const SPORT = { id: '33333333-3333-4333-8333-333333333333', code: 'RUGBY', name: 'Rugby' };

function club() {
  return {
    id: CLUB_ID,
    name: 'Barbarians Montpellier',
    shortName: 'Barbarians',
    primaryColor: '#A91234',
    secondaryColor: '#FFFFFF',
    primarySportId: SPORT.id,
    primarySport: SPORT,
  };
}

function createPrismaMock() {
  const prisma = {
    sport: { findUnique: vi.fn() },
    club: { create: vi.fn() },
    clubMembership: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    clubInvitation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  return prisma;
}

describe('ClubsService', () => {
  it('crée le club et son adhésion active dans une transaction', async () => {
    const prisma = createPrismaMock();
    prisma.sport.findUnique.mockResolvedValue(SPORT);
    prisma.club.create.mockResolvedValue(club());
    prisma.clubMembership.create.mockResolvedValue({});
    const service = new ClubsService(prisma as unknown as PrismaService);

    const result = await service.create(USER_ID, {
      name: 'Barbarians Montpellier',
      shortName: 'Barbarians',
      primaryColor: '#a91234',
      secondaryColor: '#ffffff',
      primarySportCode: 'RUGBY',
    });

    expect(prisma.clubMembership.create).toHaveBeenCalledWith({
      data: { clubId: CLUB_ID, userId: USER_ID, status: MembershipStatus.ACTIVE },
    });
    expect(result.club).toMatchObject({ id: CLUB_ID, primaryColor: '#A91234' });
  });

  it('refuse la gestion des invitations hors du club', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue(null);
    const service = new ClubsService(prisma as unknown as PrismaService);

    await expect(
      service.createInvitation(USER_ID, CLUB_ID, 'player@squadpost.local'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.clubInvitation.create).not.toHaveBeenCalled();
  });

  it('crée une invitation avec un jeton qui ne sera pas persisté en clair', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.clubMembership.findFirst.mockResolvedValue(null);
    prisma.clubInvitation.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'invitation-1',
        email: data.email,
        expiresAt: data.expiresAt,
        acceptedAt: null,
        createdAt: new Date(),
      }),
    );
    const service = new ClubsService(prisma as unknown as PrismaService);

    const result = await service.createInvitation(USER_ID, CLUB_ID, ' Player@SquadPost.local ');

    expect(result.invitation.token).toMatch(/^[A-Za-z0-9_-]{40,100}$/);
    expect(prisma.clubInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'player@squadpost.local',
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(prisma.clubInvitation.create.mock.calls[0]![0].data.tokenHash).not.toBe(
      result.invitation.token,
    );
  });

  it("refuse l'acceptation par une autre adresse e-mail", async () => {
    const prisma = createPrismaMock();
    prisma.clubInvitation.findUnique.mockResolvedValue({
      id: 'invitation-1',
      clubId: CLUB_ID,
      email: 'player@squadpost.local',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      club: club(),
    });
    const service = new ClubsService(prisma as unknown as PrismaService);

    await expect(
      service.acceptInvitation({ id: USER_ID, email: 'autre@squadpost.local' }, 'a'.repeat(43)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.clubMembership.upsert).not.toHaveBeenCalled();
  });

  it('refuse une invitation déjà utilisée', async () => {
    const prisma = createPrismaMock();
    prisma.clubInvitation.findUnique.mockResolvedValue({
      id: 'invitation-1',
      clubId: CLUB_ID,
      email: 'player@squadpost.local',
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      club: club(),
    });
    const service = new ClubsService(prisma as unknown as PrismaService);

    await expect(
      service.acceptInvitation({ id: USER_ID, email: 'player@squadpost.local' }, 'a'.repeat(43)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("active l'adhésion lors de l'acceptation d'une invitation valide", async () => {
    const prisma = createPrismaMock();
    prisma.clubInvitation.findUnique.mockResolvedValue({
      id: 'invitation-1',
      clubId: CLUB_ID,
      email: 'player@squadpost.local',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      club: club(),
    });
    prisma.clubMembership.upsert.mockResolvedValue({});
    prisma.clubInvitation.update.mockResolvedValue({});
    const service = new ClubsService(prisma as unknown as PrismaService);

    const result = await service.acceptInvitation(
      { id: USER_ID, email: 'player@squadpost.local' },
      'a'.repeat(43),
    );

    expect(prisma.clubMembership.upsert).toHaveBeenCalledWith({
      where: { userId_clubId: { userId: USER_ID, clubId: CLUB_ID } },
      update: { status: MembershipStatus.ACTIVE },
      create: { userId: USER_ID, clubId: CLUB_ID, status: MembershipStatus.ACTIVE },
    });
    expect(prisma.clubInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invitation-1' },
      data: { acceptedAt: expect.any(Date) },
    });
    expect(result.club.id).toBe(CLUB_ID);
  });
});
