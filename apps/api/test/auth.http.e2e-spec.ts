import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response as SupertestResponse } from 'supertest';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
const ALLOWED_ORIGIN = 'http://localhost:3000';
const DISALLOWED_ORIGIN = 'http://evil.example.test';

type CookieHeader = string | string[] | undefined;
type AuthenticatedBody = {
  status: 'authenticated';
  session: {
    sessionId: string;
    organizationId: string;
  };
  sessionToken?: unknown;
};
type OrganizationSelectionBody = {
  status: 'organization_selection_required';
  organizations: unknown[];
  sessionToken?: unknown;
};

function extractCookiePair(cookies: CookieHeader, cookieName: string): string {
  const normalizedCookies = Array.isArray(cookies)
    ? cookies
    : typeof cookies === 'string'
      ? [cookies]
      : [];
  const cookie = normalizedCookies.find((entry) =>
    entry.startsWith(`${cookieName}=`),
  );

  if (!cookie) {
    throw new Error(`Missing cookie ${cookieName}`);
  }

  return cookie.split(';')[0];
}

function extractCookieValue(
  cookies: CookieHeader | undefined,
  cookieName: string,
): string {
  return extractCookiePair(cookies, cookieName).slice(cookieName.length + 1);
}

function normalizeCookies(cookies: CookieHeader): string[] {
  if (Array.isArray(cookies)) {
    return cookies;
  }

  if (typeof cookies === 'string') {
    return [cookies];
  }

  return [];
}

async function getCsrf(
  agent: ReturnType<typeof request.agent>,
  ipAddress: string,
): Promise<{
  csrfToken: string;
  csrfCookie: string;
  response: SupertestResponse;
}> {
  const response = await agent
    .get('/auth/csrf')
    .set('Origin', ALLOWED_ORIGIN)
    .set('X-Forwarded-For', ipAddress)
    .expect(200);

  return {
    csrfToken: (response.body as { csrfToken: string }).csrfToken,
    csrfCookie: extractCookiePair(
      response.headers['set-cookie'],
      'courier_csrf',
    ),
    response,
  };
}

describe('HTTP authentication flow', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    employeeFacilityIds: [] as string[],
    employeeIds: [] as string[],
    facilityIds: [] as string[],
    organizationIds: [] as string[],
    userIds: [] as string[],
  };

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('exposes secure cookie-based authentication with CSRF, organization selection, rotation, and logout', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app);
      await app.init();

      prismaService = moduleRef.get<PrismaService>(PrismaService);
      const passwordHasher = moduleRef.get<PasswordHasher>(PasswordHasher);
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const singleAgent = request.agent(server);
      const multiAgent = request.agent(server);
      const unauthorizedSelectAgent = request.agent(server);
      const rateLimitAgent = request.agent(server);
      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8).toUpperCase();
      const password = 'Correct Horse Battery Staple 123!';
      const passwordHash = await passwordHasher.hash(password);

      const singleOrganization = await prismaService.organization.create({
        data: {
          legalName: `Single Organization ${suffix}`,
          commercialName: `Single Organization ${suffix}`,
          slug: `single-http-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(singleOrganization.id);

      const multiOrganizationOne = await prismaService.organization.create({
        data: {
          legalName: `Multi One ${suffix}`,
          commercialName: `Multi One ${suffix}`,
          slug: `multi-one-http-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(multiOrganizationOne.id);

      const multiOrganizationTwo = await prismaService.organization.create({
        data: {
          legalName: `Multi Two ${suffix}`,
          commercialName: `Multi Two ${suffix}`,
          slug: `multi-two-http-${suffix}`,
          status: 'TRIAL',
        },
      });
      cleanup.organizationIds.push(multiOrganizationTwo.id);

      const outsiderOrganization = await prismaService.organization.create({
        data: {
          legalName: `Outsider ${suffix}`,
          commercialName: `Outsider ${suffix}`,
          slug: `outsider-http-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(outsiderOrganization.id);

      const singleUser = await prismaService.user.create({
        data: {
          email: `single.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(singleUser.id);

      const multiUser = await prismaService.user.create({
        data: {
          email: `multi.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(multiUser.id);

      const singleEmployee = await prismaService.employee.create({
        data: {
          organizationId: singleOrganization.id,
          userId: singleUser.id,
          employeeCode: `SNG-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(singleEmployee.id);

      const multiEmployeeOne = await prismaService.employee.create({
        data: {
          organizationId: multiOrganizationOne.id,
          userId: multiUser.id,
          employeeCode: `MUL1-${shortCode}`,
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(multiEmployeeOne.id);

      const multiEmployeeTwo = await prismaService.employee.create({
        data: {
          organizationId: multiOrganizationTwo.id,
          userId: multiUser.id,
          employeeCode: `MUL2-${shortCode}`,
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(multiEmployeeTwo.id);

      const singleFacility = await prismaService.facility.create({
        data: {
          organizationId: singleOrganization.id,
          code: `SNG-${shortCode}`,
          name: 'Single Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(singleFacility.id);

      const multiFacilityOne = await prismaService.facility.create({
        data: {
          organizationId: multiOrganizationOne.id,
          code: `M1-${shortCode}`,
          name: 'Multi Facility One',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(multiFacilityOne.id);

      const multiFacilityTwo = await prismaService.facility.create({
        data: {
          organizationId: multiOrganizationTwo.id,
          code: `M2-${shortCode}`,
          name: 'Multi Facility Two',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(multiFacilityTwo.id);

      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: singleOrganization.id,
              employeeId: singleEmployee.id,
              facilityId: singleFacility.id,
              isPrimary: true,
            },
          })
        ).id,
      );
      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: multiOrganizationOne.id,
              employeeId: multiEmployeeOne.id,
              facilityId: multiFacilityOne.id,
              isPrimary: true,
            },
          })
        ).id,
      );
      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: multiOrganizationTwo.id,
              employeeId: multiEmployeeTwo.id,
              facilityId: multiFacilityTwo.id,
              isPrimary: true,
            },
          })
        ).id,
      );

      await request(server).get('/health').expect(200);
      await request(server).get('/auth/session').expect(401);

      const singleCsrf = await getCsrf(singleAgent, '203.0.113.1');
      expect(singleCsrf.response.headers['cache-control']).toBe('no-store');
      expect(singleCsrf.response.headers['access-control-allow-origin']).toBe(
        ALLOWED_ORIGIN,
      );
      expect(
        singleCsrf.response.headers['access-control-allow-origin'],
      ).not.toBe('*');
      expect(singleCsrf.csrfToken).toMatch(/^cf1\.[A-Za-z0-9_-]{43}$/);

      await singleAgent
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', '203.0.113.1')
        .send({
          email: singleUser.email,
          password,
        })
        .expect(403);

      await singleAgent
        .post('/auth/login')
        .set('Origin', DISALLOWED_ORIGIN)
        .set('X-CSRF-Token', singleCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.2')
        .send({
          email: singleUser.email,
          password,
        })
        .expect(403);

      await singleAgent
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', singleCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.3')
        .send({
          email: singleUser.email,
          password,
          organizationId: singleOrganization.id,
        })
        .expect(400);

      const invalidCredentialsResponse = await singleAgent
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', singleCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.4')
        .send({
          email: 'missing.user@courier.test',
          password,
        })
        .expect(401);

      expect(invalidCredentialsResponse.body).toEqual({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Authentication failed.',
        },
      });

      const singleLoginResponse = await singleAgent
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', singleCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.5')
        .send({
          email: singleUser.email,
          password,
        })
        .expect(200);
      const singleLoginBody = singleLoginResponse.body as AuthenticatedBody;

      expect(singleLoginBody.status).toBe('authenticated');
      expect(singleLoginBody.session.organizationId).toBe(
        singleOrganization.id,
      );
      expect(singleLoginBody.sessionToken).toBeUndefined();
      expect(singleLoginResponse.headers['cache-control']).toBe('no-store');
      const singleSessionCookie = extractCookiePair(
        singleLoginResponse.headers['set-cookie'],
        'courier_session',
      );
      expect(singleSessionCookie).toContain('courier_session=');
      expect(singleLoginResponse.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('HttpOnly'),
          expect.stringContaining('SameSite=Strict'),
          expect.stringContaining('Path=/'),
        ]),
      );

      const singlePersistedSession =
        await prismaService.userSession.findFirstOrThrow({
          where: {
            employeeId: singleEmployee.id,
            revokedAt: null,
          },
        });

      expect(singlePersistedSession.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(singlePersistedSession.tokenHash).not.toBe(
        extractCookieValue(
          singleLoginResponse.headers['set-cookie'],
          'courier_session',
        ),
      );

      const sessionResponse = await singleAgent
        .get('/auth/session')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', '203.0.113.5')
        .expect(200);
      const sessionBody = sessionResponse.body as {
        session: {
          organizationId: string;
          sessionId: string;
        };
        sessionToken?: unknown;
      };

      expect(sessionBody.session.organizationId).toBe(singleOrganization.id);
      expect(sessionBody.session.sessionId).toBe(singlePersistedSession.id);
      expect(sessionBody.sessionToken).toBeUndefined();

      const rotateResponse = await singleAgent
        .post('/auth/session/rotate')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', singleCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.5')
        .expect(204);

      const rotatedSessionToken = extractCookieValue(
        rotateResponse.headers['set-cookie'],
        'courier_session',
      );
      expect(rotatedSessionToken).not.toBe(
        extractCookieValue(
          singleLoginResponse.headers['set-cookie'],
          'courier_session',
        ),
      );

      await singleAgent
        .get('/auth/session')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', '203.0.113.5')
        .expect(200);

      await singleAgent
        .post('/auth/logout')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', singleCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.5')
        .expect(204);

      await singleAgent.get('/auth/session').expect(401);

      const logoutCsrf = await getCsrf(singleAgent, '203.0.113.6');
      await singleAgent
        .post('/auth/logout')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', logoutCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.6')
        .expect(204);

      const multiCsrf = await getCsrf(multiAgent, '203.0.113.10');
      const multiLoginResponse = await multiAgent
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', multiCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.10')
        .send({
          email: multiUser.email,
          password,
        })
        .expect(200);
      const multiLoginBody =
        multiLoginResponse.body as OrganizationSelectionBody;

      expect(multiLoginBody).toMatchObject({
        status: 'organization_selection_required',
      });
      expect(multiLoginBody.organizations).toHaveLength(2);
      expect(multiLoginBody.sessionToken).toBeUndefined();
      const multiLoginSessionCookie = normalizeCookies(
        multiLoginResponse.headers['set-cookie'],
      ).find((cookieHeader): cookieHeader is string =>
        cookieHeader.startsWith('courier_session='),
      );

      if (multiLoginSessionCookie) {
        expect(multiLoginSessionCookie).toContain('courier_session=;');
      }

      const loginChallengeCookie = extractCookiePair(
        multiLoginResponse.headers['set-cookie'],
        'courier_login',
      );
      const loginChallengeToken = extractCookieValue(
        multiLoginResponse.headers['set-cookie'],
        'courier_login',
      );

      const persistedChallenge =
        await prismaService.loginChallenge.findFirstOrThrow({
          where: {
            userId: multiUser.id,
            consumedAt: null,
            invalidatedAt: null,
          },
        });

      expect(persistedChallenge.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(persistedChallenge.tokenHash).not.toBe(loginChallengeToken);

      const selectedOrganizationResponse = await multiAgent
        .post('/auth/select-organization')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', multiCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.10')
        .send({
          organizationId: multiOrganizationTwo.id,
        })
        .expect(200);
      const selectedOrganizationBody =
        selectedOrganizationResponse.body as AuthenticatedBody;

      expect(selectedOrganizationBody.status).toBe('authenticated');
      expect(selectedOrganizationBody.session.organizationId).toBe(
        multiOrganizationTwo.id,
      );
      expect(selectedOrganizationBody.sessionToken).toBeUndefined();
      expect(selectedOrganizationResponse.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('courier_session='),
          expect.stringContaining('courier_login=;'),
        ]),
      );

      const replayResponse = await request(server)
        .post('/auth/select-organization')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', multiCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.11')
        .set('Cookie', [loginChallengeCookie, multiCsrf.csrfCookie])
        .send({
          organizationId: multiOrganizationOne.id,
        })
        .expect(401);

      expect(replayResponse.body).toEqual({
        error: {
          code: 'LOGIN_CHALLENGE_INVALID_TOKEN',
          message: 'Authentication required.',
        },
      });

      const unauthorizedCsrf = await getCsrf(
        unauthorizedSelectAgent,
        '203.0.113.20',
      );
      await unauthorizedSelectAgent
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', unauthorizedCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.20')
        .send({
          email: multiUser.email,
          password,
        })
        .expect(200);

      await unauthorizedSelectAgent
        .post('/auth/select-organization')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', unauthorizedCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.20')
        .send({
          organizationId: outsiderOrganization.id,
        })
        .expect(403);

      const rateLimitCsrf = await getCsrf(rateLimitAgent, '203.0.113.50');
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await rateLimitAgent
          .post('/auth/login')
          .set('Origin', ALLOWED_ORIGIN)
          .set('X-CSRF-Token', rateLimitCsrf.csrfToken)
          .set('X-Forwarded-For', '203.0.113.50')
          .send({
            email: `missing-${attempt}.${suffix}@courier.test`,
            password,
          })
          .expect(401);
      }

      await rateLimitAgent
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', rateLimitCsrf.csrfToken)
        .set('X-Forwarded-For', '203.0.113.50')
        .send({
          email: `missing-rate-limit.${suffix}@courier.test`,
          password,
        })
        .expect(429);
    } finally {
      if (prismaService) {
        await prismaService.userSession.deleteMany({
          where: {
            employeeId: {
              in: cleanup.employeeIds,
            },
          },
        });
        await prismaService.loginChallenge.deleteMany({
          where: {
            userId: {
              in: cleanup.userIds,
            },
          },
        });
        await prismaService.employeeFacility.deleteMany({
          where: {
            id: {
              in: cleanup.employeeFacilityIds,
            },
          },
        });
        await prismaService.employee.deleteMany({
          where: {
            id: {
              in: cleanup.employeeIds,
            },
          },
        });
        await prismaService.facility.deleteMany({
          where: {
            id: {
              in: cleanup.facilityIds,
            },
          },
        });
        await prismaService.organization.deleteMany({
          where: {
            id: {
              in: cleanup.organizationIds,
            },
          },
        });
        await prismaService.user.deleteMany({
          where: {
            id: {
              in: cleanup.userIds,
            },
          },
        });

        const remainingLoginChallenges =
          await prismaService.loginChallenge.count({
            where: {
              userId: {
                in: cleanup.userIds,
              },
            },
          });
        const remainingSessions = await prismaService.userSession.count({
          where: {
            employeeId: {
              in: cleanup.employeeIds,
            },
          },
        });

        expect(remainingLoginChallenges).toBe(0);
        expect(remainingSessions).toBe(0);
      }

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  }, 90000);
});
