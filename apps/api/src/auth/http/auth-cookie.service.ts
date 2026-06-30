import type { Response } from 'express';
import { Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from './authenticated-request.type';

const CSRF_COOKIE_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_COOKIE_PATH = '/';
const SESSION_COOKIE_BASE_NAME = 'courier_session';
const LOGIN_COOKIE_BASE_NAME = 'courier_login';
const CSRF_COOKIE_BASE_NAME = 'courier_csrf';

@Injectable()
export class AuthCookieService {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly secure = this.resolveCookieSecure();

  constructor() {
    if (this.isProduction && !this.secure) {
      throw new Error('COOKIE_SECURE must be true in production');
    }
  }

  getSessionCookieName(): string {
    return this.withProductionPrefix(SESSION_COOKIE_BASE_NAME);
  }

  getLoginChallengeCookieName(): string {
    return this.withProductionPrefix(LOGIN_COOKIE_BASE_NAME);
  }

  getCsrfCookieName(): string {
    return this.withProductionPrefix(CSRF_COOKIE_BASE_NAME);
  }

  readSessionToken(request: AuthenticatedRequest): string | null {
    return this.readCookieValue(request.cookies, this.getSessionCookieName());
  }

  readLoginChallengeToken(request: AuthenticatedRequest): string | null {
    return this.readCookieValue(
      request.cookies,
      this.getLoginChallengeCookieName(),
    );
  }

  readCsrfToken(request: AuthenticatedRequest): string | null {
    return this.readCookieValue(request.cookies, this.getCsrfCookieName());
  }

  setSessionCookie(
    response: Response,
    sessionToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(this.getSessionCookieName(), sessionToken, {
      ...this.sharedCookieOptions(),
      expires: expiresAt,
      httpOnly: true,
    });
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(
      this.getSessionCookieName(),
      this.sharedCookieOptions(),
    );
  }

  setLoginChallengeCookie(
    response: Response,
    challengeToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(this.getLoginChallengeCookieName(), challengeToken, {
      ...this.sharedCookieOptions(),
      expires: expiresAt,
      httpOnly: true,
    });
  }

  clearLoginChallengeCookie(response: Response): void {
    response.clearCookie(
      this.getLoginChallengeCookieName(),
      this.sharedCookieOptions(),
    );
  }

  setCsrfCookie(response: Response, csrfToken: string): void {
    response.cookie(this.getCsrfCookieName(), csrfToken, {
      ...this.sharedCookieOptions(),
      expires: new Date(Date.now() + CSRF_COOKIE_TTL_MS),
      httpOnly: true,
    });
  }

  clearCsrfCookie(response: Response): void {
    response.clearCookie(this.getCsrfCookieName(), this.sharedCookieOptions());
  }

  private sharedCookieOptions() {
    return {
      path: DEFAULT_COOKIE_PATH,
      sameSite: 'strict' as const,
      secure: this.secure,
    };
  }

  private resolveCookieSecure(): boolean {
    const rawValue = process.env.COOKIE_SECURE;

    if (!rawValue) {
      return false;
    }

    return rawValue.trim().toLowerCase() === 'true';
  }

  private withProductionPrefix(baseName: string): string {
    return this.isProduction ? `__Host-${baseName}` : baseName;
  }

  private readCookieValue(cookies: unknown, cookieName: string): string | null {
    if (!cookies || typeof cookies !== 'object') {
      return null;
    }

    const value = (cookies as Record<string, unknown>)[cookieName];

    return typeof value === 'string' ? value : null;
  }
}
