import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ClubsService } from '../src/clubs/clubs.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';

describe('Club permissions', () => {
  let app: INestApplication;
  const club = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Barbarians Montpellier',
    shortName: 'Barbarians',
    primaryColor: '#A91234',
    secondaryColor: '#FFFFFF',
    primarySport: { code: 'RUGBY', name: 'Rugby' },
  };
  const clubsService = {
    listForUser: vi.fn().mockResolvedValue({ clubs: [] }),
    create: vi.fn().mockResolvedValue({ club }),
    listInvitations: vi.fn().mockResolvedValue({ invitations: [] }),
    createInvitation: vi.fn(),
    acceptInvitation: vi.fn().mockResolvedValue({ club }),
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
      .overrideProvider(ClubsService)
      .useValue(clubsService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app.close());

  it('autorise COM_MANAGER à créer un club', async () => {
    await request(app.getHttpServer())
      .post('/api/clubs')
      .set('Cookie', 'squadpost_session=communication-token')
      .send({ name: 'Barbarians' })
      .expect(201)
      .expect({ club });
  });

  it.each(['player-token', 'admin-token'])(
    'refuse la création de club au jeton %s',
    async (token) => {
      await request(app.getHttpServer())
        .post('/api/clubs')
        .set('Cookie', `squadpost_session=${token}`)
        .send({})
        .expect(403);
    },
  );

  it('autorise PLAYER à accepter une invitation', async () => {
    await request(app.getHttpServer())
      .post('/api/club-invitations/accept')
      .set('Cookie', 'squadpost_session=player-token')
      .send({ token: 'a'.repeat(43) })
      .expect(201)
      .expect({ club });
  });

  it('autorise PLAYER à lister ses clubs mais pas à créer une invitation', async () => {
    await request(app.getHttpServer())
      .get('/api/clubs')
      .set('Cookie', 'squadpost_session=player-token')
      .expect(200)
      .expect({ clubs: [] });

    await request(app.getHttpServer())
      .post(`/api/clubs/${club.id}/invitations`)
      .set('Cookie', 'squadpost_session=player-token')
      .send({ email: 'player@squadpost.local' })
      .expect(403);
  });

  it("n'accorde aucun accès club au rôle ADMIN", async () => {
    await request(app.getHttpServer())
      .get('/api/clubs')
      .set('Cookie', 'squadpost_session=admin-token')
      .expect(403);
  });
});
