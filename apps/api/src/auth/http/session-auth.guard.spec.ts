import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { InvalidSessionTokenError } from '../../sessions/session.errors';
import type { SessionsService } from '../../sessions/sessions.service';
import type { SessionContext } from '../../sessions/session.types';
import { AuthCookieService } from './auth-cookie.service';
import { SessionAuthGuard } from './session-auth.guard';

describe('SessionAuthGuard', () => {
  const session: SessionContext = {
    sessionId: '8300ed7e-8cad-4e6f-ab0c-e52bd4fcb289',
    userId: 'af8e8d64-6547-4278-bcd0-0c0c0d15b7aa',
    email: 'session.guard@courier.test',
    organizationId: 'a56d53ae-56ad-4627-b4ae-0116bb50c85d',
    organizationSlug: 'guard-org',
    organizationName: 'Guard Org',
    employeeId: 'f5f547b7-6721-4d1e-9dd1-40565c53fb06',
    firstName: 'Grace',
    lastName: 'Hopper',
    facilityIds: ['d0d2107e-bf93-46f4-a116-95f4cb270246'],
    expiresAt: new Date('2026-06-29T12:00:00.000Z'),
  };

  function createContext(request: Record<string, unknown>): ExecutionContext {
    return {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
        getResponse: () => ({
          clearCookie: jest.fn(),
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('respects routes marked as public', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const sessionsService = {} as SessionsService;
    const authCookieService = new AuthCookieService();
    const guard = new SessionAuthGuard(
      reflector,
      sessionsService,
      authCookieService,
    );

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
  });

  it('attaches request.auth when the session cookie is valid', async () => {
    process.env.NODE_ENV = 'development';
    process.env.COOKIE_SECURE = 'false';

    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const sessionsService = {
      validateSession: jest.fn().mockResolvedValue(session),
    } as unknown as SessionsService;
    const authCookieService = new AuthCookieService();
    const request = {
      cookies: {
        courier_session: 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      },
    };
    const guard = new SessionAuthGuard(
      reflector,
      sessionsService,
      authCookieService,
    );

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect((request as { auth?: SessionContext }).auth).toEqual(session);
  });

  it('rejects missing cookies with a generic invalid-session error', async () => {
    process.env.NODE_ENV = 'development';
    process.env.COOKIE_SECURE = 'false';

    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const sessionsService = {
      validateSession: jest.fn(),
    } as unknown as SessionsService;
    const authCookieService = new AuthCookieService();
    const guard = new SessionAuthGuard(
      reflector,
      sessionsService,
      authCookieService,
    );

    await expect(
      guard.canActivate(createContext({ cookies: {} })),
    ).rejects.toBeInstanceOf(InvalidSessionTokenError);
  });
});
