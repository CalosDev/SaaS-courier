import type { Response } from 'express';

import { AuthCookieService } from './auth-cookie.service';

describe('AuthCookieService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieSecure = process.env.COOKIE_SECURE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.COOKIE_SECURE = originalCookieSecure;
  });

  it('uses development cookie names without __Host- prefix', () => {
    process.env.NODE_ENV = 'development';
    process.env.COOKIE_SECURE = 'false';

    const service = new AuthCookieService();

    expect(service.getSessionCookieName()).toBe('courier_session');
    expect(service.getLoginChallengeCookieName()).toBe('courier_login');
    expect(service.getCsrfCookieName()).toBe('courier_csrf');
  });

  it('uses secure production cookie names with __Host- prefix', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'true';

    const service = new AuthCookieService();

    expect(service.getSessionCookieName()).toBe('__Host-courier_session');
    expect(service.getLoginChallengeCookieName()).toBe('__Host-courier_login');
    expect(service.getCsrfCookieName()).toBe('__Host-courier_csrf');
  });

  it('fails in production when COOKIE_SECURE is false', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';

    expect(() => new AuthCookieService()).toThrow(
      'COOKIE_SECURE must be true in production',
    );
  });

  it('sets HttpOnly Strict cookies without a domain', () => {
    process.env.NODE_ENV = 'development';
    process.env.COOKIE_SECURE = 'false';

    const service = new AuthCookieService();
    const cookie = jest.fn();
    const response = {
      cookie,
    } as unknown as Response;

    service.setSessionCookie(
      response,
      'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      new Date('2026-06-29T12:00:00.000Z'),
    );

    const [, , options] = cookie.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];

    expect(options).toMatchObject({
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: false,
    });
    expect(options.domain).toBeUndefined();
  });
});
