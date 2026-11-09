import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { readCookie, SESSION_COOKIE_NAME } from './cookies.js';
import type { RequestWithAuth } from './auth.types.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    request.auth = await this.authService.authenticate(token);
    return true;
  }
}
