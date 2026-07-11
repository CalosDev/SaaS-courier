import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { AppModule } from '../src/app.module';
import { AuthCookieService } from '../src/auth/http/auth-cookie.service';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/rbac/rbac.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const ALLOWED_ORIGIN = 'http://localhost:3000';

function extractCookiePair(
  cookies: string | string[] | undefined,
  cookieName: string,
): string {
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

describe('Rates HTTP E2E', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    serviceIds: [] as string[],
    rateCardIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('serves services, rate cards, and quotes with tenant-scoped permissions', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app);
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const passwordHasher = moduleRef.get(PasswordHasher);
      const rbacService = moduleRef.get(RbacService);
      const sessionsService = moduleRef.get(SessionsService);
      const authCookieService = moduleRef.get(AuthCookieService);

      await rbacService.syncPermissionCatalog();

      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8).toUpperCase();
      const passwordHash = await passwordHasher.hash(
        'Correct Horse Battery Staple 123!',
      );

      const organization = await prisma.organization.create({
        data: {
          legalName: `Rates Org HTTP ${suffix}`,
          commercialName: `Rates Org HTTP ${suffix}`,
          slug: `rates-http-${suffix}`,
          currencyCode: 'DOP',
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: organization.id },
      });

      const user = await prisma.user.create({
        data: {
          email: `rates-http.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          employeeCode: `EMP-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employee.id);

      const role = await rbacService.createRole({
        organizationId: organization.id,
        code: `RATES_${shortCode}`,
        name: 'Rates Admin',
      });
      cleanup.roleIds.push(role.id);

      await rbacService.assignRoleToEmployee({
        organizationId: organization.id,
        employeeId: employee.id,
        roleId: role.id,
      });

      const session = await sessionsService.createSession({
        userId: user.id,
        organizationId: organization.id,
      });
      cleanup.sessionIds.push(session.session.sessionId);

      const sessionCookie = `${authCookieService.getSessionCookieName()}=${session.sessionToken}`;
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const csrfResponse = await request(server)
        .get('/auth/csrf')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);
      const csrfBody = csrfResponse.body as { csrfToken: string };
      const csrfCookie = extractCookiePair(
        csrfResponse.headers['set-cookie'],
        authCookieService.getCsrfCookieName(),
      );

      // Unauthenticated
      await request(server).get('/services').expect(401);

      // Authenticated but no permission
      await request(server)
        .get('/services')
        .set('Cookie', sessionCookie)
        .expect(403);

      // Add permissions
      const readPermission = await prisma.permission.findUniqueOrThrow({
        where: { code: 'rates.read' },
      });
      const managePermission = await prisma.permission.findUniqueOrThrow({
        where: { code: 'rates.manage' },
      });
      await prisma.rolePermission.createMany({
        data: [
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: readPermission.id,
          },
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: managePermission.id,
          },
        ],
      });

      // Create Service
      const createServiceRes = await request(server)
        .post('/services')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: 'STND',
          name: 'Standard',
          description: 'Standard delivery',
        })
        .expect(201);

      const createdService = createServiceRes.body;
      cleanup.serviceIds.push(createdService.id);
      expect(createdService.code).toBe('STND');

      // Create Rate Card
      const createRateCardRes = await request(server)
        .post('/rate-cards')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          serviceId: createdService.id,
          name: 'Standard Retail',
          segmentKey: 'RETAIL',
          segmentName: 'Retail Customers',
          calculationType: 'FLAT',
        })
        .expect(201);

      const createdCard = createRateCardRes.body;
      cleanup.rateCardIds.push(createdCard.id);
      expect(createdCard.status).toBe('DRAFT');

      // Replace Rules
      await request(server)
        .put(`/rate-cards/${createdCard.id}/rules`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          rules: [
            { flatAmountMinor: 150000 }, // $1,500
          ],
        })
        .expect(200);

      // Activate Rate Card
      const activateRes = await request(server)
        .post(`/rate-cards/${createdCard.id}/activate`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(200);

      expect(activateRes.body.status).toBe('ACTIVE');

      // Quote
      const quoteRes = await request(server)
        .post('/rates/quote')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          rateCardId: createdCard.id,
          weight: 5,
        })
        .expect(200);

      expect(quoteRes.body.quote.courierAmountMinor).toBe('150000');
    } finally {
      if (prismaService) {
        if (cleanup.rateCardIds.length > 0) {
          await prismaService.rateRule.deleteMany({
            where: { rateCardId: { in: cleanup.rateCardIds } },
          });
          await prismaService.rateCard.deleteMany({
            where: { id: { in: cleanup.rateCardIds } },
          });
        }
        if (cleanup.serviceIds.length > 0) {
          await prismaService.courierService.deleteMany({
            where: { id: { in: cleanup.serviceIds } },
          });
        }
        if (cleanup.sessionIds.length > 0) {
          await prismaService.userSession.deleteMany({
            where: { id: { in: cleanup.sessionIds } },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employeeRole.deleteMany({
            where: { employeeId: { in: cleanup.employeeIds } },
          });
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.rolePermission.deleteMany({
            where: { roleId: { in: cleanup.roleIds } },
          });
          await prismaService.role.deleteMany({
            where: { id: { in: cleanup.roleIds } },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employee.deleteMany({
            where: { id: { in: cleanup.employeeIds } },
          });
        }
        if (cleanup.userIds.length > 0) {
          await prismaService.user.deleteMany({
            where: { id: { in: cleanup.userIds } },
          });
        }
        if (cleanup.organizationIds.length > 0) {
          await deleteAuditArtifactsForOrganizations(
            prismaService,
            cleanup.organizationIds,
          );
          await prismaService.organizationSettings.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.organization.deleteMany({
            where: { id: { in: cleanup.organizationIds } },
          });
        }
      }

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  }, 120000);
});
