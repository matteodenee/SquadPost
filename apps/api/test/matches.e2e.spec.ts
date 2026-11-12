import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';
import { MatchesService } from '../src/matches/matches.service.js';

const CLUB_ID = '22222222-2222-4222-8222-222222222222';

describe('Match permissions', () => {
  let app: INestApplication;
  const service = {
    listOpponents: vi.fn().mockResolvedValue({ opponents: [] }),
    createOpponent: vi.fn(),
    updateOpponent: vi.fn(),
    changeOpponentStatus: vi.fn(),
    listMatches: vi.fn().mockResolvedValue({ matches: [] }),
    createMatch: vi.fn().mockResolvedValue({ match: { id: 'match-id' } }),
    updateMatch: vi.fn(),
    changeMatchStatus: vi.fn(),
  };

  beforeAll(async () => {
    const authService = {
      authenticate: vi.fn((token: string) => {
        const role =
          token === 'communication-token'
            ? UserRole.COM_MANAGER
            : token === 'admin-token'
              ? UserRole.ADMIN
              : UserRole.PLAYER;
        return Promise.resolve({
          id: `${role.toLowerCase()}-id`,
          email: 'test@squadpost.local',
          role,
          permissions: [],
        });
      }),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(MatchesService)
      .useValue(service)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => app.close());

  it('autorise COM_MANAGER à créer un match', async () => {
    await request(app.getHttpServer())
      .post(`/api/clubs/${CLUB_ID}/matches`)
      .set('Cookie', 'squadpost_session=communication-token')
      .send({ seasonId: 'season', opponentId: 'opponent', clubScore: 24, opponentScore: 17 })
      .expect(201);

    expect(service.createMatch).toHaveBeenCalledWith(
      'com_manager-id',
      CLUB_ID,
      expect.objectContaining({ clubScore: 24, opponentScore: 17 }),
    );
  });

  it('autorise COM_MANAGER à annuler un match', async () => {
    service.changeMatchStatus.mockResolvedValueOnce({
      match: { id: 'match-id', status: 'CANCELLED' },
    });
    await request(app.getHttpServer())
      .patch(`/api/clubs/${CLUB_ID}/matches/match-id/status`)
      .set('Cookie', 'squadpost_session=communication-token')
      .send({ status: 'CANCELLED' })
      .expect(200);

    expect(service.changeMatchStatus).toHaveBeenCalledWith(
      'com_manager-id',
      CLUB_ID,
      'match-id',
      'CANCELLED',
    );
  });

  it('autorise COM_MANAGER à modifier les informations et le score', async () => {
    service.updateMatch.mockResolvedValueOnce({
      match: { id: 'match-id', round: 'Journée 5', clubScore: 28, opponentScore: 21 },
    });
    await request(app.getHttpServer())
      .patch(`/api/clubs/${CLUB_ID}/matches/match-id`)
      .set('Cookie', 'squadpost_session=communication-token')
      .send({ round: 'Journée 5', clubScore: 28, opponentScore: 21 })
      .expect(200);

    expect(service.updateMatch).toHaveBeenCalledWith(
      'com_manager-id',
      CLUB_ID,
      'match-id',
      expect.objectContaining({ round: 'Journée 5', clubScore: 28, opponentScore: 21 }),
    );
  });

  it.each(['player-token', 'admin-token'])('refuse les matchs au jeton %s', async (token) => {
    await request(app.getHttpServer())
      .get(`/api/clubs/${CLUB_ID}/matches`)
      .set('Cookie', `squadpost_session=${token}`)
      .expect(403);
  });
});
