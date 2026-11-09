import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../generated/prisma/client.js';
import type { RequestWithAuth } from './auth.types.js';
import { USER_ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(USER_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowedRoles?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth || !allowedRoles.includes(request.auth.role)) {
      throw new ForbiddenException("Votre rôle ne permet pas d'accéder à cette ressource.");
    }

    return true;
  }
}
