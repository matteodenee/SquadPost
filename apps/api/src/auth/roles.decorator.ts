import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../generated/prisma/client.js';

export const USER_ROLES_KEY = 'user_roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(USER_ROLES_KEY, roles);
