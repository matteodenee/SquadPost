import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';
import { PlayersService } from '../src/players/players.service.js';

const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const PLAYER_ID = '33333333-3333-4333-8333-333333333333';

describe('Player roster permissions', () => {
  let app: INestApplication;
  const player = {
    id: PLAYER_ID,
    clubId: CLUB_ID,
    userId: null,
    firstName: 'Lina',
    lastName: 'Martin',
    primaryPosition: null,
    usualJerseyNumber: null,
    active: true,
    compositionPhoto: null,
  };
  const playersService = {
    list: vi.fn().mockResolvedValue({ players: [player] }),
    get: vi.fn().mockResolvedValue({ player }),
    create: vi.fn().mockResolvedValue({ player }),
    update: vi.fn().mockResolvedValue({ player }),
    changeStatus: vi.fn().mockResolvedValue({ player: { ...player, active: false } }),
    replacePhoto: vi.fn().mockResolvedValue({ player }),
    listOwn: vi.fn().mockResolvedValue({ players: [player] }),
    readPhoto: vi.fn(),
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
          email: `${role.toLowerCase()}@squadpost.local`,
          firstName: null,
          lastName: null,
          role,
          permissions: [],
        });
      }),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(PlayersService)
      .useValue(playersService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app.close());

  it('autorise COM_MANAGER à lister et créer dans un effectif', async () => {
    await request(app.getHttpServer())
      .get(`/api/clubs/${CLUB_ID}/players`)
      .set('Cookie', 'squadpost_session=communication-token')
      .expect(200)
      .expect({ players: [player] });

    await request(app.getHttpServer())
      .post(`/api/clubs/${CLUB_ID}/players`)
      .set('Cookie', 'squadpost_session=communication-token')
      .send({ firstName: 'Lina', lastName: 'Martin' })
      .expect(201)
      .expect({ player });
  });

  it.each(['player-token', 'admin-token'])(
    'refuse toute gestion de l’effectif au jeton %s',
    async (token) => {
      await request(app.getHttpServer())
        .get(`/api/clubs/${CLUB_ID}/players`)
        .set('Cookie', `squadpost_session=${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/clubs/${CLUB_ID}/players`)
        .set('Cookie', `squadpost_session=${token}`)
        .send({ firstName: 'Lina', lastName: 'Martin' })
        .expect(403);
    },
  );

  it('autorise PLAYER à consulter uniquement ses fiches associées', async () => {
    await request(app.getHttpServer())
      .get('/api/me/player-profiles')
      .set('Cookie', 'squadpost_session=player-token')
      .expect(200)
      .expect({ players: [player] });

    await request(app.getHttpServer())
      .get('/api/me/player-profiles')
      .set('Cookie', 'squadpost_session=communication-token')
      .expect(403);
  });
});
