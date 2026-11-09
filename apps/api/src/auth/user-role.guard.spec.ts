import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { UserRole } from '../generated/prisma/client.js';
import type { AuthenticatedUser, RequestWithAuth } from './auth.types.js';
import { UserRoleGuard } from './user-role.guard.js';

function createContext(user: AuthenticatedUser): ExecutionContext {
  const request: RequestWithAuth = { headers: {}, auth: user };
  return {
    getHandler: () => createContext,
    getClass: () => UserRoleGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('UserRoleGuard', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'communication@squadpost.local',
    role: UserRole.COM_MANAGER,
    permissions: [],
  };

  it('autorise un rôle déclaré sur la ressource', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.COM_MANAGER, UserRole.ADMIN],
    } as unknown as Reflector;

    expect(new UserRoleGuard(reflector).canActivate(createContext(user))).toBe(true);
  });

  it('refuse un rôle non autorisé', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN],
    } as unknown as Reflector;

    expect(() => new UserRoleGuard(reflector).canActivate(createContext(user))).toThrow(
      ForbiddenException,
    );
  });
});
