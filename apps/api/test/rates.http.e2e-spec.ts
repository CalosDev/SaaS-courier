import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';
import {
  configureHttpE2eEnvironment,
  createAuthenticatedHttpSession,
  createHttpE2eContext,
  fetchCsrfContext,
  HTTP_TEST_ORIGIN as ALLOWED_ORIGIN,
} from './http-e2e-test-kit';

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

  beforeAll(configureHttpE2eEnvironment);

  it('serves services, rate cards, and quotes with tenant-scoped permissions', async () => {
    try {
      const httpContext = await createHttpE2eContext();
      moduleRef = httpContext.moduleRef;
      app = httpContext.app;
      const {
        prisma,
        passwordHasher,
        rbacService,
        sessionsService,
        authCookieService,
        server,
      } = httpContext;
      prismaService = prisma;

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

      const session = await createAuthenticatedHttpSession({
        sessionsService,
        authCookieService,
        userId: user.id,
        organizationId: organization.id,
        cleanupSessionIds: cleanup.sessionIds,
      });

      const sessionCookie = session.sessionCookie;
      const { csrfToken, csrfCookie } = await fetchCsrfContext({
        server,
        authCookieService,
      });
      const csrfBody = { csrfToken };

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
