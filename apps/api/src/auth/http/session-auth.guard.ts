import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { Reflector } from '@nestjs/core';

import {
  InvalidSessionInputError,
  InvalidSessionTokenError,
} from '../../sessions/session.errors';
import { SessionsService } from '../../sessions/sessions.service';
import type { AuthenticatedRequest } from './authenticated-request.type';
import { AuthCookieService } from './auth-cookie.service';
import { IS_PUBLIC_ROUTE } from './public.decorator';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionsService: SessionsService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<'http'>() !== 'http') {
      return true;
    }

    if (this.isPublicRoute(context)) {
      return true;
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AuthenticatedRequest>();
    const response = httpContext.getResponse<Response>();
    const sessionToken = this.authCookieService.readSessionToken(request);

    if (!sessionToken) {
      throw new InvalidSessionTokenError();
    }

    try {
      request.auth = await this.sessionsService.validateSession({
        sessionToken,
      });
      return true;
    } catch (error) {
      if (
        error instanceof InvalidSessionTokenError ||
        error instanceof InvalidSessionInputError
      ) {
        this.authCookieService.clearSessionCookie(response);
        throw new InvalidSessionTokenError();
      }

      throw error;
    }
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
