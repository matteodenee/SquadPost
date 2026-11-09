import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import type { AuthenticatedUser, AuthenticationResult } from './auth.types.js';
import { permissionsForRole } from './user-permissions.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1_000;
const DUMMY_PASSWORD_HASH = hashPassword('mot-de-passe-factice-non-utilisable');

interface LoginInput {
  email?: unknown;
  password?: unknown;
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async login(input: LoginInput): Promise<AuthenticationResult> {
    const email = this.validateEmail(input.email);
    const password = this.validatePassword(input.password);
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? (await DUMMY_PASSWORD_HASH),
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      },
    });

    return { token, user: this.toAuthenticatedUser(user) };
  }

  async authenticate(token: string | undefined): Promise<AuthenticatedUser> {
    if (!token) throw new UnauthorizedException('Authentification requise.');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        user: true,
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session expirée ou invalide.');
    }

    return this.toAuthenticatedUser(session.user);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: this.hashToken(token) } });
  }

  private validateEmail(value: unknown): string {
    if (typeof value !== 'string') {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }

    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }
    return email;
  }

  private validatePassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }
    return value;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    role: AuthenticatedUser['role'];
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissionsForRole(user.role),
    };
  }
}
