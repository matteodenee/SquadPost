import { ConflictException } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client.js';
import type { PrismaService } from '../database/prisma.service.js';
import { AuthService } from './auth.service.js';

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    session: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('AuthService.register', () => {
  it('crée toujours un compte PLAYER et ouvre une session', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'user-1',
        email: data.email,
        firstName: null,
        lastName: null,
        passwordHash: data.passwordHash,
        role: data.role,
      }),
    );
    const service = new AuthService(prisma as unknown as PrismaService);

    const result = await service.register({
      email: '  Nouveau@SquadPost.local ',
      password: 'Mot-de-passe-solide-2026!',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'nouveau@squadpost.local',
        passwordHash: expect.stringMatching(/^scrypt\$/),
        role: UserRole.PLAYER,
      },
    });
    expect(prisma.session.create).toHaveBeenCalledOnce();
    expect(result.user).toMatchObject({
      email: 'nouveau@squadpost.local',
      role: UserRole.PLAYER,
      permissions: ['profile:read:self'],
    });
  });

  it('refuse une adresse déjà utilisée', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });
    const service = new AuthService(prisma as unknown as PrismaService);

    await expect(
      service.register({
        email: 'player@squadpost.local',
        password: 'Mot-de-passe-solide-2026!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe trop court', async () => {
    const prisma = createPrismaMock();
    const service = new AuthService(prisma as unknown as PrismaService);

    await expect(
      service.register({ email: 'nouveau@squadpost.local', password: 'court' }),
    ).rejects.toThrow('Le mot de passe doit contenir entre 12 et 128 caractères.');
  });

  it('refuse une session appartenant à un compte désactivé', async () => {
    const prisma = createPrismaMock();
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'disabled@squadpost.local',
        firstName: null,
        lastName: null,
        role: UserRole.PLAYER,
        disabledAt: new Date(),
      },
    });
    const service = new AuthService(prisma as unknown as PrismaService);

    await expect(service.authenticate('disabled-token')).rejects.toThrow(
      'Ce compte est désactivé.',
    );
    expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
  });
});
