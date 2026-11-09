import { UserRole } from '../generated/prisma/client.js';

export const USER_PERMISSIONS = [
  'profile:read:self',
  'dashboard:access',
  'players:manage',
  'roster:manage',
  'lineups:manage',
  'visuals:generate',
  'matches:manage',
  'publications:manage',
  'users:read',
  'users:create',
  'users:update',
  'users:deactivate',
  'users:delete',
  'users:assign-role',
] as const;

export type UserPermission = (typeof USER_PERMISSIONS)[number];

const PERMISSIONS_BY_ROLE: Record<UserRole, readonly UserPermission[]> = {
  [UserRole.PLAYER]: ['profile:read:self'],
  [UserRole.COM_MANAGER]: [
    'profile:read:self',
    'dashboard:access',
    'players:manage',
    'roster:manage',
    'lineups:manage',
    'visuals:generate',
    'matches:manage',
    'publications:manage',
  ],
  [UserRole.ADMIN]: [
    'profile:read:self',
    'dashboard:access',
    'users:read',
    'users:create',
    'users:update',
    'users:deactivate',
    'users:delete',
    'users:assign-role',
  ],
};

export function permissionsForRole(role: UserRole): readonly UserPermission[] {
  return PERMISSIONS_BY_ROLE[role];
}
