import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { CompetitionsService } from '../src/competitions/competitions.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';

const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const FORMAT_ID = '33333333-3333-4333-8333-333333333333';

describe('Competition permissions', () => {
  let app: INestApplication;
  const competition = {
    id: '44444444-4444-4444-8444-444444444444',
    clubId: CLUB_ID,
    name: 'Championnat',
    starterCount: 10,
    finisherCount: 5,
    active: true,
    seasons: [],
  };
  const service = {
    listSportFormats: vi.fn().mockResolvedValue({ formats: [] }),
    list: vi.fn().mockResolvedValue({ competitions: [competition] }),
    create: vi.fn().mockResolvedValue({ competition }),
    update: vi.fn().mockResolvedValue({ competition }),
    changeStatus: vi.fn().mockResolvedValue({ competition }),
    createSeason: vi.fn(),
    updateSeason: vi.fn(),
    changeSeasonStatus: vi.fn(),
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
      .overrideProvider(CompetitionsService)
      .useValue(service)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app.close());

  it('autorise COM_MANAGER à créer une compétition avec des nombres personnalisés', async () => {
    await request(app.getHttpServer())
      .post(`/api/clubs/${CLUB_ID}/competitions`)
      .set('Cookie', 'squadpost_session=communication-token')
      .send({
        name: 'Championnat',
        sportFormatId: FORMAT_ID,
        starterCount: 12,
        finisherCount: 6,
      })
      .expect(201)
      .expect({ competition });

    expect(service.create).toHaveBeenCalledWith(
      'com_manager-id',
      CLUB_ID,
      expect.objectContaining({ starterCount: 12, finisherCount: 6 }),
    );
  });

  it.each(['player-token', 'admin-token'])(
    'refuse la gestion des compétitions au jeton %s',
    async (token) => {
      await request(app.getHttpServer())
        .get(`/api/clubs/${CLUB_ID}/competitions`)
        .set('Cookie', `squadpost_session=${token}`)
        .expect(403);
    },
  );
});
