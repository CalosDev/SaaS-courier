import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PasswordHasher } from '../src/accounts/password-hasher';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/rbac/rbac.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { AuthCookieService } from '../src/auth/http/auth-cookie.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
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

describe('Organization and facilities admin HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    facilityIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
  });

  it('serves the approved organization and facilities endpoints with real sessions and permissions', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app);
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      const passwordHasher = moduleRef.get(PasswordHasher);
      const rbacService = moduleRef.get(RbacService);
      const sessionsService = moduleRef.get(SessionsService);
      const authCookieService = moduleRef.get(AuthCookieService);
      prismaService = prisma;

      const passwordHash = await passwordHasher.hash(
        'Correct Horse Battery Staple 123!',
      );
      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8).toUpperCase();

      await rbacService.syncPermissionCatalog();

      const organization = await prisma.organization.create({
        data: {
          legalName: `HTTP Org ${suffix}`,
          commercialName: `HTTP Org ${suffix}`,
          slug: `http-org-${suffix}`,
          maxFacilities: 2,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);

      const otherOrganization = await prisma.organization.create({
        data: {
          legalName: `HTTP Other ${suffix}`,
          commercialName: `HTTP Other ${suffix}`,
          slug: `http-other-${suffix}`,
          maxFacilities: 4,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(otherOrganization.id);

      const user = await prisma.user.create({
        data: {
          email: `organization-facilities.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
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
        code: `ADMIN_${shortCode}`,
        name: 'Admin Role',
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

      await request(server).get('/health').expect(200);
      await request(server)
        .get('/auth/session')
        .set('Cookie', sessionCookie)
        .expect(200);
      await request(server).get('/organizations/current').expect(401);
      await request(server)
        .get('/organizations/current')
        .set('Cookie', sessionCookie)
        .expect(403);

      await prisma.rolePermission.createMany({
        data: [
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: (
              await prisma.permission.findUniqueOrThrow({
                where: { code: 'organizations.read' },
                select: { id: true },
              })
            ).id,
          },
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: (
              await prisma.permission.findUniqueOrThrow({
                where: { code: 'facilities.read' },
                select: { id: true },
              })
            ).id,
          },
        ],
      });

      const currentOrganizationResponse = await request(server)
        .get('/organizations/current')
        .set('Cookie', sessionCookie)
        .expect(200);
      const currentOrganizationBody = currentOrganizationResponse.body as {
        id: string;
        legalName: string;
        commercialName: string;
        slug: string;
        status: string;
        deletedAt?: unknown;
      };

      expect(currentOrganizationResponse.headers['cache-control']).toBe(
        'no-store',
      );
      expect(currentOrganizationBody).toMatchObject({
        id: organization.id,
        legalName: organization.legalName,
        commercialName: organization.commercialName,
        slug: organization.slug,
        status: 'ACTIVE',
      });
      expect(currentOrganizationBody.deletedAt).toBeUndefined();

      await request(server)
        .patch('/organizations/current')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          legalName: 'Updated Legal Name',
        })
        .expect(403);

      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: (
            await prisma.permission.findUniqueOrThrow({
              where: { code: 'organizations.manage' },
              select: { id: true },
            })
          ).id,
        },
      });

      const updatedOrganizationResponse = await request(server)
        .patch('/organizations/current')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          legalName: '  Updated Legal Name  ',
          commercialName: '  Updated Commercial Name  ',
          email: '  Updated@Courier.Test  ',
          rnc: ' 131313131 ',
          phone: ' 809-555-0110 ',
        })
        .expect(200);
      const updatedOrganizationBody = updatedOrganizationResponse.body as {
        legalName: string;
        commercialName: string;
        email: string | null;
        rnc: string | null;
        phone: string | null;
      };

      expect(updatedOrganizationBody).toMatchObject({
        legalName: 'Updated Legal Name',
        commercialName: 'Updated Commercial Name',
        email: 'updated@courier.test',
        rnc: '131313131',
        phone: '809-555-0110',
      });

      await request(server)
        .patch('/organizations/current')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          slug: 'should-not-change',
          status: 'SUSPENDED',
          planCode: 'ENTERPRISE',
          organizationId: otherOrganization.id,
        })
        .expect(400);

      await request(server)
        .post('/facilities')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: 'SDQ',
          name: 'Santo Domingo',
          type: 'BRANCH',
        })
        .expect(403);

      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: (
            await prisma.permission.findUniqueOrThrow({
              where: { code: 'facilities.manage' },
              select: { id: true },
            })
          ).id,
        },
      });

      const createdFacilityResponse = await request(server)
        .post('/facilities')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: '  sdq  ',
          name: '  Santo Domingo  ',
          type: 'BRANCH',
          email: '  SDQ@Courier.Test ',
          addressLine1: '  Calle 1 ',
        })
        .expect(201);
      const createdFacilityBody = createdFacilityResponse.body as {
        id: string;
        code: string;
        name: string;
        type: string;
        ownershipType: string;
        countryCode: string;
        email: string | null;
        addressLine1: string | null;
        isCustomerFacing: boolean;
        isPackageOrigin: boolean;
        isDistributionCenter: boolean;
        isActive: boolean;
        organizationId?: unknown;
        deletedAt?: unknown;
      };

      expect(createdFacilityResponse.headers['cache-control']).toBe('no-store');
      expect(createdFacilityBody).toMatchObject({
        code: 'SDQ',
        name: 'Santo Domingo',
        type: 'BRANCH',
        ownershipType: 'OWNED',
        countryCode: 'DO',
        email: 'sdq@courier.test',
        addressLine1: 'Calle 1',
        isCustomerFacing: true,
        isPackageOrigin: false,
        isDistributionCenter: false,
        isActive: true,
      });
      expect(createdFacilityBody.organizationId).toBeUndefined();
      expect(createdFacilityBody.deletedAt).toBeUndefined();

      const createdFacilityId = createdFacilityBody.id;
      cleanup.facilityIds.push(createdFacilityId);

      const otherFacility = await prisma.facility.create({
        data: {
          organizationId: otherOrganization.id,
          code: 'SDQ',
          name: 'Other Tenant Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(otherFacility.id);

      const facilitiesListResponse = await request(server)
        .get('/facilities?page=1&pageSize=10')
        .set('Cookie', sessionCookie)
        .expect(200);
      const facilitiesListBody = facilitiesListResponse.body as {
        items: Array<{ id: string }>;
        pagination: {
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
        };
      };

      expect(facilitiesListBody.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(facilitiesListBody.items).toHaveLength(1);

      await request(server)
        .get(`/facilities/${createdFacilityId}`)
        .set('Cookie', sessionCookie)
        .expect(200);

      await request(server)
        .get(`/facilities/${otherFacility.id}`)
        .set('Cookie', sessionCookie)
        .expect(404);

      const updatedFacilityResponse = await request(server)
        .patch(`/facilities/${createdFacilityId}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: '  sdq-main ',
          name: '  SDQ Main ',
          phone: ' 809-555-0112 ',
          isActive: false,
        })
        .expect(200);
      const updatedFacilityBody = updatedFacilityResponse.body as {
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
      };

      expect(updatedFacilityBody).toMatchObject({
        code: 'SDQ-MAIN',
        name: 'SDQ Main',
        phone: '809-555-0112',
        isActive: false,
      });

      await request(server)
        .patch(`/facilities/${otherFacility.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          name: 'Should Not Update',
        })
        .expect(404);

      await request(server)
        .post('/facilities')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: 'sdq-main',
          name: 'Duplicate',
          type: 'BRANCH',
        })
        .expect(409);

      const allowedOtherTenantDuplicate = await prisma.facility.findFirst({
        where: {
          organizationId: otherOrganization.id,
          code: 'SDQ',
        },
      });
      expect(allowedOtherTenantDuplicate).not.toBeNull();

      await request(server)
        .post('/facilities')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: 'SCL',
          name: 'Second Facility',
          type: 'BRANCH',
        })
        .expect(201)
        .then((response) => {
          const body = response.body as { id: string };
          cleanup.facilityIds.push(body.id);
        });

      await request(server)
        .post('/facilities')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: 'POP',
          name: 'Third Facility',
          type: 'BRANCH',
        })
        .expect(409);

      await request(server)
        .post('/facilities')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          code: 'MIA',
          name: 'Invalid',
          type: 'BRANCH',
          organizationId: otherOrganization.id,
          deletedAt: new Date().toISOString(),
        })
        .expect(400);
    } finally {
      if (prismaService) {
        if (cleanup.facilityIds.length > 0) {
          await prismaService.employeeFacility.deleteMany({
            where: {
              facilityId: {
                in: cleanup.facilityIds,
              },
            },
          });
        }
        if (cleanup.sessionIds.length > 0) {
          await prismaService.userSession.deleteMany({
            where: {
              id: {
                in: cleanup.sessionIds,
              },
            },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employeeRole.deleteMany({
            where: {
              employeeId: {
                in: cleanup.employeeIds,
              },
            },
          });
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.rolePermission.deleteMany({
            where: {
              roleId: {
                in: cleanup.roleIds,
              },
            },
          });
        }
        if (cleanup.facilityIds.length > 0) {
          await prismaService.facility.deleteMany({
            where: {
              id: {
                in: cleanup.facilityIds,
              },
            },
          });
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.role.deleteMany({
            where: {
              id: {
                in: cleanup.roleIds,
              },
            },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employee.deleteMany({
            where: {
              id: {
                in: cleanup.employeeIds,
              },
            },
          });
        }
        if (cleanup.userIds.length > 0) {
          await prismaService.user.deleteMany({
            where: {
              id: {
                in: cleanup.userIds,
              },
            },
          });
        }
        if (cleanup.organizationIds.length > 0) {
          await prismaService.organization.deleteMany({
            where: {
              id: {
                in: cleanup.organizationIds,
              },
            },
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
  }, 90000);
});
