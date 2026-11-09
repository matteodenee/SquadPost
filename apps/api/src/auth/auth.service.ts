import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { UserRole } from '../generated/prisma/client.js';
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

interface RegisterInput {
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

    return this.createSession(user);
  }

  async register(input: RegisterInput): Promise<AuthenticationResult> {
    const email = this.validateRegistrationEmail(input.email);
    const password = this.validateRegistrationPassword(input.password);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(password),
          role: UserRole.PLAYER,
        },
      });

      return this.createSession(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
      }
      throw error;
    }
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

  private validateRegistrationEmail(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Une adresse e-mail valide est obligatoire.');
    }

    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Une adresse e-mail valide est obligatoire.');
    }
    return email;
  }

  private validateRegistrationPassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
      throw new BadRequestException('Le mot de passe doit contenir entre 12 et 128 caractères.');
    }
    return value;
  }

  private async createSession(user: {
    id: string;
    email: string;
    role: AuthenticatedUser['role'];
  }): Promise<AuthenticationResult> {
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

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
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
