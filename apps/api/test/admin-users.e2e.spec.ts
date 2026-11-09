import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';

const users = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@squadpost.local',
    firstName: 'Alex',
    lastName: 'Admin',
    role: UserRole.ADMIN,
    disabledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
];

describe('Admin users permissions', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const authService = {
      authenticate: vi.fn((token: string) => {
        const role =
          token === 'admin-token'
            ? UserRole.ADMIN
            : token === 'communication-token'
              ? UserRole.COM_MANAGER
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
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue(users) },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('autorise un ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', 'squadpost_session=admin-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.users).toHaveLength(1);
        expect(body.users[0]).not.toHaveProperty('passwordHash');
      });
  });

  it.each(['player-token', 'communication-token'])('refuse le rôle du jeton %s', async (token) => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', `squadpost_session=${token}`)
      .expect(403);
  });
});
