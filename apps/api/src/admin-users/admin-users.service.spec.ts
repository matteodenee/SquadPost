import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { UserRole } from '../generated/prisma/client.js';
import { AdminUsersService } from './admin-users.service.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    email: 'player@squadpost.local',
    passwordHash: 'hash',
    firstName: 'Camille',
    lastName: 'Joueur',
    role: UserRole.PLAYER,
    disabledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function createPrismaMock() {
  const prisma = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  return prisma;
}

describe('AdminUsersService', () => {
  it('crée un compte standard après validation', async () => {
    const prisma = createPrismaMock();
    prisma.user.create.mockImplementation(({ data }) => Promise.resolve(user(data)));
    const service = new AdminUsersService(prisma as unknown as PrismaService);

    const result = await service.create({
      email: ' Nouveau@SquadPost.local ',
      password: 'Mot-de-passe-solide-2026!',
      firstName: 'Nouveau',
      lastName: 'Joueur',
      role: UserRole.COM_MANAGER,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'nouveau@squadpost.local',
        firstName: 'Nouveau',
        lastName: 'Joueur',
        role: UserRole.COM_MANAGER,
        passwordHash: expect.stringMatching(/^scrypt\$/),
      }),
      select: expect.any(Object),
    });
    expect(result.user.role).toBe(UserRole.COM_MANAGER);
  });

  it('refuse de créer directement un ADMIN', async () => {
    const prisma = createPrismaMock();
    const service = new AdminUsersService(prisma as unknown as PrismaService);

    await expect(
      service.create({
        email: 'admin2@squadpost.local',
        password: 'Mot-de-passe-solide-2026!',
        role: UserRole.ADMIN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('interdit de modifier son propre rôle', async () => {
    const prisma = createPrismaMock();
    const service = new AdminUsersService(prisma as unknown as PrismaService);

    await expect(service.changeRole(ACTOR_ID, ACTOR_ID, UserRole.PLAYER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('protège le dernier administrateur actif contre une rétrogradation', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(user({ role: UserRole.ADMIN }));
    prisma.user.count.mockResolvedValue(1);
    const service = new AdminUsersService(prisma as unknown as PrismaService);

    await expect(service.changeRole(ACTOR_ID, TARGET_ID, UserRole.PLAYER)).rejects.toThrow(
      'Le dernier administrateur actif ne peut pas être rétrogradé.',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('invalide les sessions lors de la désactivation', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(user());
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve(user({ disabledAt: data.disabledAt })),
    );
    prisma.session.deleteMany.mockResolvedValue({ count: 2 });
    const service = new AdminUsersService(prisma as unknown as PrismaService);

    const result = await service.changeStatus(ACTOR_ID, TARGET_ID, false);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET_ID } });
    expect(result.user.active).toBe(false);
  });

  it('protège le dernier administrateur actif contre la désactivation', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(user({ role: UserRole.ADMIN }));
    prisma.user.count.mockResolvedValue(1);
    const service = new AdminUsersService(prisma as unknown as PrismaService);

    await expect(service.changeStatus(ACTOR_ID, TARGET_ID, false)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it('exige la confirmation dédiée pour promouvoir un ADMIN', async () => {
    const prisma = createPrismaMock();
    const service = new AdminUsersService(prisma as unknown as PrismaService);

    await expect(service.promoteToAdmin(ACTOR_ID, TARGET_ID, 'oui')).rejects.toThrow(
      'La confirmation explicite « PROMOUVOIR ADMIN » est obligatoire.',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
