import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { MembershipStatus, UserRole } from '../generated/prisma/client.js';
import type { MediaStorageService } from './media-storage.service.js';
import { PlayersService } from './players.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const PLAYER_ID = '33333333-3333-4333-8333-333333333333';

function player(overrides = {}) {
  return {
    id: PLAYER_ID,
    clubId: CLUB_ID,
    userId: null,
    firstName: 'Lina',
    lastName: 'Martin',
    primaryPosition: null,
    usualJerseyNumber: null,
    compositionPhotoId: null,
    inactiveAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    compositionPhoto: null,
    ...overrides,
  };
}

function createPrismaMock() {
  const prisma = {
    clubMembership: { findUnique: vi.fn() },
    clubPlayer: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    mediaAsset: { create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  return prisma;
}

function serviceWith(prisma: ReturnType<typeof createPrismaMock>) {
  const storage = { storePlayerPhoto: vi.fn(), read: vi.fn(), remove: vi.fn() };
  return {
    service: new PlayersService(
      prisma as unknown as PrismaService,
      storage as unknown as MediaStorageService,
    ),
    storage,
  };
}

describe('PlayersService', () => {
  it('crée une fiche joueur sans compte associé', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.clubPlayer.create.mockResolvedValue(player());
    const { service } = serviceWith(prisma);

    const result = await service.create(USER_ID, CLUB_ID, {
      firstName: ' Lina ',
      lastName: ' Martin ',
      usualJerseyNumber: 12,
    });

    expect(prisma.clubPlayer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clubId: CLUB_ID,
          firstName: 'Lina',
          lastName: 'Martin',
          userId: undefined,
        }),
      }),
    );
    expect(result.player.userId).toBeNull();
  });

  it("refuse l'accès à l'effectif d'un autre club", async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue(null);
    const { service } = serviceWith(prisma);

    await expect(service.list(USER_ID, CLUB_ID, '')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.clubPlayer.findMany).not.toHaveBeenCalled();
  });

  it('n’associe qu’un compte PLAYER actif et membre du club', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.user.findFirst.mockResolvedValue(null);
    const { service } = serviceWith(prisma);

    await expect(
      service.create(USER_ID, CLUB_ID, {
        firstName: 'Lina',
        lastName: 'Martin',
        userId: PLAYER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: PLAYER_ID,
        role: UserRole.PLAYER,
        disabledAt: null,
        memberships: { some: { clubId: CLUB_ID, status: MembershipStatus.ACTIVE } },
      },
    });
  });

  it('ne retourne au PLAYER que ses propres fiches liées', async () => {
    const prisma = createPrismaMock();
    prisma.clubPlayer.findMany.mockResolvedValue([
      player({ club: { id: CLUB_ID, name: 'Barbarians', shortName: 'BMR' } }),
    ]);
    const { service } = serviceWith(prisma);

    const result = await service.listOwn(USER_ID);

    expect(prisma.clubPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER_ID,
          club: { memberships: { some: { userId: USER_ID, status: MembershipStatus.ACTIVE } } },
        },
      }),
    );
    expect(result.players).toHaveLength(1);
  });

  it('ne supprime pas la nouvelle photo si le nettoyage de l’ancienne échoue', async () => {
    const prisma = createPrismaMock();
    prisma.clubMembership.findUnique.mockResolvedValue({ status: MembershipStatus.ACTIVE });
    prisma.clubPlayer.findFirst.mockResolvedValue(
      player({
        compositionPhoto: {
          id: 'old-asset',
          storageKey: 'old.png',
          mimeType: 'image/png',
          sizeBytes: 10,
          width: 2,
          height: 2,
          hasAlpha: true,
        },
      }),
    );
    prisma.mediaAsset.create.mockResolvedValue({ id: 'new-asset' });
    prisma.clubPlayer.update.mockResolvedValue(
      player({
        compositionPhoto: {
          id: 'new-asset',
          storageKey: 'new.png',
          mimeType: 'image/png',
          sizeBytes: 12,
          width: 2,
          height: 2,
          hasAlpha: true,
        },
      }),
    );
    const { service, storage } = serviceWith(prisma);
    storage.storePlayerPhoto.mockResolvedValue({
      storageKey: 'new.png',
      mimeType: 'image/png',
      sizeBytes: 12,
      width: 2,
      height: 2,
      hasAlpha: true,
    });
    storage.remove.mockRejectedValueOnce(new Error('disk busy'));

    await expect(
      service.replacePhoto(USER_ID, CLUB_ID, PLAYER_ID, {
        buffer: Buffer.from('image'),
        size: 5,
      }),
    ).resolves.toMatchObject({ player: { compositionPhoto: { mimeType: 'image/png' } } });
    expect(storage.remove).toHaveBeenCalledTimes(1);
    expect(storage.remove).toHaveBeenCalledWith('old.png');
  });
});
