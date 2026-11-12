import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { MembershipStatus } from '../generated/prisma/client.js';
import { MatchesService } from './matches.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const SEASON_ID = '33333333-3333-4333-8333-333333333333';
const OPPONENT_ID = '44444444-4444-4444-8444-444444444444';
const MATCH_ID = '55555555-5555-4555-8555-555555555555';

function prismaMock() {
  return {
    clubMembership: { findUnique: vi.fn() },
    opponent: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    season: { findFirst: vi.fn() },
    match: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
}

describe('MatchesService', () => {
  it('fige les capacités de la compétition à la création du match', async () => {
    const prisma = prismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    const season = {
      id: SEASON_ID,
      inactiveAt: null,
      competition: {
        id: 'competition-id',
        name: 'Championnat',
        starterCount: 12,
        finisherCount: 6,
        sportFormat: { name: 'Rugby à 10', sport: { name: 'Rugby' } },
      },
    };
    const opponent = { id: OPPONENT_ID, clubId: CLUB_ID, inactiveAt: null };
    prisma.season.findFirst.mockResolvedValue(season);
    prisma.opponent.findFirst.mockResolvedValue(opponent);
    prisma.match.create.mockResolvedValue({
      id: 'match-id',
      clubId: CLUB_ID,
      round: null,
      scheduledAt: null,
      venue: null,
      location: null,
      status: 'UPCOMING',
      clubScore: null,
      opponentScore: null,
      snapshotStarterCount: 12,
      snapshotFinisherCount: 6,
      snapshotSportName: 'Rugby',
      snapshotFormatName: 'Rugby à 10',
      createdAt: new Date(),
      updatedAt: new Date(),
      season,
      opponent: {
        ...opponent,
        name: 'MHR',
        shortName: 'MHR',
        primaryColor: null,
        secondaryColor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const service = new MatchesService(prisma as unknown as PrismaService);

    await service.createMatch(USER_ID, CLUB_ID, { seasonId: SEASON_ID, opponentId: OPPONENT_ID });

    expect(prisma.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotStarterCount: 12,
          snapshotFinisherCount: 6,
          snapshotSportName: 'Rugby',
          snapshotFormatName: 'Rugby à 10',
        }),
      }),
    );
  });

  it("refuse les matchs d'un club sans adhésion active", async () => {
    const prisma = prismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue(null);
    const service = new MatchesService(prisma as unknown as PrismaService);
    await expect(service.listMatches(USER_ID, CLUB_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse un score hors limites', async () => {
    const prisma = prismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.match.findFirst.mockResolvedValue({ id: MATCH_ID, clubId: CLUB_ID });
    const service = new MatchesService(prisma as unknown as PrismaService);

    await expect(
      service.updateMatch(USER_ID, CLUB_ID, MATCH_ID, { clubScore: 1000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
