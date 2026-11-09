import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { readCookie, SESSION_COOKIE_NAME, sessionCookieOptions } from './cookies.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import type { RequestWithAuth } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email?: unknown; password?: unknown },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    response.cookie(SESSION_COOKIE_NAME, result.token, sessionCookieOptions(expiresAt));
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: RequestWithAuth) {
    return { user: request.auth };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    await this.authService.logout(token);
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  }
}
