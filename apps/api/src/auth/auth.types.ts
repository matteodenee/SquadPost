import type { UserRole } from '../generated/prisma/client.js';
import type { UserPermission } from './user-permissions.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  permissions: readonly UserPermission[];
}

export interface AuthenticationResult {
  token: string;
  user: AuthenticatedUser;
}

export interface RequestWithAuth {
  headers: Record<string, string | string[] | undefined>;
  auth?: AuthenticatedUser;
}
