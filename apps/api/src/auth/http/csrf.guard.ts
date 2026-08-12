import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from './authenticated-request.type';
import { AuthCookieService } from './auth-cookie.service';
import { CsrfTokenService } from './csrf-token.service';
import { SKIP_CSRF_KEY } from './skip-csrf.decorator';
import { isAllowedOrigin, loadAllowedOrigins } from '../../http/allowed-origin';

const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class CsrfValidationError extends Error {
  readonly code = 'AUTH_CSRF_VALIDATION_FAILED';

  constructor() {
    super('CSRF validation failed');
    this.name = new.target.name;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins = loadAllowedOrigins();

  constructor(
    private readonly reflector: Reflector,
    private readonly authCookieService: AuthCookieService,
    private readonly csrfTokenService: CsrfTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType<'http'>() !== 'http') {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AuthenticatedRequest>();

    if (!UNSAFE_HTTP_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    if (!this.isAllowedOrigin(request.headers.origin)) {
      throw new CsrfValidationError();
    }

    const cookieToken = this.authCookieService.readCsrfToken(request);
    const headerToken = this.readHeaderToken(request);

    if (!cookieToken || !headerToken) {
      throw new CsrfValidationError();
    }

    if (!this.csrfTokenService.tokensMatch(cookieToken, headerToken)) {
      throw new CsrfValidationError();
    }

    return true;
  }

  private readHeaderToken(request: AuthenticatedRequest): string | null {
    const rawHeader = request.headers['x-csrf-token'];

    if (typeof rawHeader === 'string') {
      return rawHeader;
    }

    if (Array.isArray(rawHeader) && typeof rawHeader[0] === 'string') {
      return rawHeader[0];
    }

    return null;
  }

  private isAllowedOrigin(origin: string | undefined): boolean {
    return (
      typeof origin === 'string' && isAllowedOrigin(origin, this.allowedOrigins)
    );
  }
}
