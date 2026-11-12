import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { MembershipStatus } from '../generated/prisma/client.js';
import { CompetitionsService } from './competitions.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const FORMAT_ID = '33333333-3333-4333-8333-333333333333';
const COMPETITION_ID = '44444444-4444-4444-8444-444444444444';

const format = {
  id: FORMAT_ID,
  code: 'RUGBY_10',
  name: 'Rugby à 10',
  defaultStarterCount: 10,
  defaultFinisherCount: 5,
  sportId: '55555555-5555-4555-8555-555555555555',
  createdAt: new Date(),
  updatedAt: new Date(),
  sport: {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'RUGBY',
    name: 'Rugby',
  },
};

function competition(overrides = {}) {
  return {
    id: COMPETITION_ID,
    clubId: CLUB_ID,
    sportFormatId: FORMAT_ID,
    name: 'Championnat universitaire',
    starterCount: 10,
    finisherCount: 5,
    inactiveAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    sportFormat: format,
    seasons: [],
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    clubMembership: { findUnique: vi.fn() },
    sportFormat: { findMany: vi.fn(), findUnique: vi.fn() },
    competition: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    season: { create: vi.fn(), update: vi.fn() },
  };
}

describe('CompetitionsService', () => {
  it('copie les valeurs du format tout en permettant des nombres personnalisés', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.sportFormat.findUnique.mockResolvedValue(format);
    prisma.competition.create.mockResolvedValue(
      competition({ starterCount: 12, finisherCount: 6 }),
    );
    const service = new CompetitionsService(prisma as unknown as PrismaService);

    const result = await service.create(USER_ID, CLUB_ID, {
      name: ' Championnat universitaire ',
      sportFormatId: FORMAT_ID,
      starterCount: 12,
      finisherCount: 6,
    });

    expect(prisma.competition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          clubId: CLUB_ID,
          sportFormatId: FORMAT_ID,
          name: 'Championnat universitaire',
          starterCount: 12,
          finisherCount: 6,
        },
      }),
    );
    expect(result.competition).toMatchObject({ starterCount: 12, finisherCount: 6 });
  });

  it('utilise les valeurs par défaut de la déclinaison si les nombres sont omis', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.sportFormat.findUnique.mockResolvedValue(format);
    prisma.competition.create.mockResolvedValue(competition());
    const service = new CompetitionsService(prisma as unknown as PrismaService);

    await service.create(USER_ID, CLUB_ID, {
      name: 'Championnat',
      sportFormatId: FORMAT_ID,
    });

    expect(prisma.competition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ starterCount: 10, finisherCount: 5 }),
      }),
    );
  });

  it("refuse l'accès aux compétitions d'un club sans adhésion active", async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue(null);
    const service = new CompetitionsService(prisma as unknown as PrismaService);

    await expect(service.list(USER_ID, CLUB_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.competition.findMany).not.toHaveBeenCalled();
  });

  it('refuse une saison dont la fin précède le début', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.competition.findFirst.mockResolvedValue(competition());
    const service = new CompetitionsService(prisma as unknown as PrismaService);

    await expect(
      service.createSeason(USER_ID, CLUB_ID, COMPETITION_ID, {
        label: '2026-2027',
        startDate: '2027-06-01',
        endDate: '2026-09-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.season.create).not.toHaveBeenCalled();
  });
});
