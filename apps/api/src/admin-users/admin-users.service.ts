import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { hashPassword } from '../auth/password.js';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface CreateUserInput {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
}

interface UpdateUserInput {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}

@Injectable()
export class AdminUsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(searchValue: unknown) {
    const search = this.validateSearch(searchValue);
    const users = await this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: USER_SELECT,
      orderBy: [{ disabledAt: 'asc' }, { createdAt: 'desc' }],
    });

    return { users: users.map((user) => this.toAdminUser(user)) };
  }

  async get(userId: string) {
    this.validateUserId(userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return { user: this.toAdminUser(user) };
  }

  async create(input: CreateUserInput) {
    const email = this.validateEmail(input.email);
    const password = this.validatePassword(input.password);
    const firstName = this.validateName(input.firstName, 'Le prénom');
    const lastName = this.validateName(input.lastName, 'Le nom');
    const role = this.validateStandardRole(input.role ?? UserRole.PLAYER);

    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash: await hashPassword(password), firstName, lastName, role },
        select: USER_SELECT,
      });
      return { user: this.toAdminUser(user) };
    } catch (error) {
      this.rethrowKnownDatabaseError(error);
      throw error;
    }
  }

  async update(userId: string, input: UpdateUserInput) {
    this.validateUserId(userId);
    if (
      input.email === undefined &&
      input.firstName === undefined &&
      input.lastName === undefined
    ) {
      throw new BadRequestException('Aucune information à modifier.');
    }

    const data = {
      ...(input.email !== undefined ? { email: this.validateEmail(input.email) } : {}),
      ...(input.firstName !== undefined
        ? { firstName: this.validateName(input.firstName, 'Le prénom') }
        : {}),
      ...(input.lastName !== undefined
        ? { lastName: this.validateName(input.lastName, 'Le nom') }
        : {}),
    };

    await this.requireUser(userId);
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: USER_SELECT,
      });
      return { user: this.toAdminUser(user) };
    } catch (error) {
      this.rethrowKnownDatabaseError(error);
      throw error;
    }
  }

  async changeRole(actorId: string, userId: string, roleValue: unknown) {
    this.validateUserId(userId);
    this.assertDifferentUser(actorId, userId, 'Vous ne pouvez pas modifier votre propre rôle.');
    const role = this.validateStandardRole(roleValue);

    const user = await this.prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({ where: { id: userId } });
        if (!target) throw new NotFoundException('Utilisateur introuvable.');

        if (target.role === UserRole.ADMIN && !target.disabledAt) {
          const activeAdminCount = await transaction.user.count({
            where: { role: UserRole.ADMIN, disabledAt: null },
          });
          if (activeAdminCount <= 1) {
            throw new ConflictException(
              'Le dernier administrateur actif ne peut pas être rétrogradé.',
            );
          }
        }

        return transaction.user.update({
          where: { id: userId },
          data: { role },
          select: USER_SELECT,
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return { user: this.toAdminUser(user) };
  }

  async promoteToAdmin(actorId: string, userId: string, confirmation: unknown) {
    this.validateUserId(userId);
    this.assertDifferentUser(actorId, userId, 'Vous ne pouvez pas modifier votre propre rôle.');
    if (confirmation !== 'PROMOUVOIR ADMIN') {
      throw new BadRequestException(
        'La confirmation explicite « PROMOUVOIR ADMIN » est obligatoire.',
      );
    }

    const target = await this.requireUser(userId);
    if (target.disabledAt) {
      throw new ConflictException('Réactivez ce compte avant de le promouvoir administrateur.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
      select: USER_SELECT,
    });
    return { user: this.toAdminUser(user) };
  }

  async changeStatus(actorId: string, userId: string, activeValue: unknown) {
    this.validateUserId(userId);
    if (typeof activeValue !== 'boolean') {
      throw new BadRequestException('Le statut actif doit être un booléen.');
    }

    if (!activeValue) {
      this.assertDifferentUser(
        actorId,
        userId,
        'Vous ne pouvez pas désactiver votre propre compte.',
      );
    }

    const user = await this.prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({ where: { id: userId } });
        if (!target) throw new NotFoundException('Utilisateur introuvable.');

        if (!activeValue && target.role === UserRole.ADMIN && !target.disabledAt) {
          const activeAdminCount = await transaction.user.count({
            where: { role: UserRole.ADMIN, disabledAt: null },
          });
          if (activeAdminCount <= 1) {
            throw new ConflictException(
              'Le dernier administrateur actif ne peut pas être désactivé.',
            );
          }
        }

        const updatedUser = await transaction.user.update({
          where: { id: userId },
          data: { disabledAt: activeValue ? null : new Date() },
          select: USER_SELECT,
        });
        if (!activeValue) await transaction.session.deleteMany({ where: { userId } });
        return updatedUser;
      },
      { isolationLevel: 'Serializable' },
    );

    return { user: this.toAdminUser(user) };
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  private assertDifferentUser(actorId: string, userId: string, message: string) {
    if (actorId === userId) throw new ForbiddenException(message);
  }

  private validateSearch(value: unknown): string {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.trim().length > 100) {
      throw new BadRequestException('La recherche est invalide.');
    }
    return value.trim();
  }

  private validateUserId(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException("L'identifiant utilisateur est invalide.");
    }
  }

  private validateEmail(value: unknown): string {
    if (typeof value !== 'string')
      throw new BadRequestException('Une adresse e-mail valide est obligatoire.');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Une adresse e-mail valide est obligatoire.');
    }
    return email;
  }

  private validatePassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
      throw new BadRequestException('Le mot de passe doit contenir entre 12 et 128 caractères.');
    }
    return value;
  }

  private validateName(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException(`${label} est invalide.`);
    const name = value.trim();
    if (!name || name.length > 80) {
      throw new BadRequestException(`${label} doit contenir entre 1 et 80 caractères.`);
    }
    return name;
  }

  private validateStandardRole(value: unknown): Exclude<UserRole, typeof UserRole.ADMIN> {
    if (value !== UserRole.PLAYER && value !== UserRole.COM_MANAGER) {
      throw new BadRequestException(
        'Le rôle doit être PLAYER ou COM_MANAGER. Utilisez la promotion explicite pour ADMIN.',
      );
    }
    return value;
  }

  private rethrowKnownDatabaseError(error: unknown): never | void {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    }
  }

  private toAdminUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    disabledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      active: user.disabledAt === null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
