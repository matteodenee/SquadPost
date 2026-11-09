import { UserRole } from '../generated/prisma/client.js';
import { permissionsForRole } from './user-permissions.js';

describe('permissionsForRole', () => {
  it('limite PLAYER à la consultation de son propre profil', () => {
    expect(permissionsForRole(UserRole.PLAYER)).toEqual(['profile:read:self']);
  });

  it('prépare les permissions métier de COM_MANAGER', () => {
    expect(permissionsForRole(UserRole.COM_MANAGER)).toEqual(
      expect.arrayContaining([
        'dashboard:access',
        'players:manage',
        'lineups:manage',
        'visuals:generate',
      ]),
    );
    expect(permissionsForRole(UserRole.COM_MANAGER)).not.toContain('users:assign-role');
  });

  it('réserve la gestion globale des comptes à ADMIN', () => {
    expect(permissionsForRole(UserRole.ADMIN)).toEqual(
      expect.arrayContaining([
        'users:read',
        'users:create',
        'users:update',
        'users:deactivate',
        'users:assign-role',
      ]),
    );
    expect(permissionsForRole(UserRole.ADMIN)).not.toContain('players:manage');
  });
});
