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

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
const ALLOWED_ORIGIN = 'http://localhost:3000';

type PrealertHttpRecord = {
  id: string;
  prealertCode: string;
  externalTrackingNumber: string;
  carrierName: string | null;
  storeName: string;
  description: string;
  quantity: number;
  declaredValue: string;
  currencyCode: string;
  invoiceStatus: string;
  status: string;
  notes?: string | null;
  cancellationReason?: string | null;
  createdBy?: {
    id: string;
    displayName: string;
  };
};

type PrealertListHttpResponse = {
  items: PrealertHttpRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

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

describe('Prealerts admin HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    customerIds: [] as string[],
    prealertIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('serves create, list, detail, update and cancel with tenant-scoped permissions and safe responses', async () => {
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
          legalName: `Prealerts Org ${suffix}`,
          commercialName: `Prealerts Org ${suffix}`,
          slug: `prealerts-http-${suffix}`,
          currencyCode: 'DOP',
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: organization.id },
      });

      const otherOrganization = await prisma.organization.create({
        data: {
          legalName: `Prealerts Other ${suffix}`,
          commercialName: `Prealerts Other ${suffix}`,
          slug: `prealerts-http-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(otherOrganization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: otherOrganization.id },
      });

      const user = await prisma.user.create({
        data: {
          email: `prealerts-http.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-03T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-03T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);
      const otherUser = await prisma.user.create({
        data: {
          email: `prealerts-http.other.${suffix}@courier.test`,
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(otherUser.id);

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
      const otherEmployee = await prisma.employee.create({
        data: {
          organizationId: otherOrganization.id,
          userId: otherUser.id,
          employeeCode: `EMP-OTHER-${shortCode}`,
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(otherEmployee.id);

      const role = await rbacService.createRole({
        organizationId: organization.id,
        code: `PREALERTS_${shortCode}`,
        name: 'Prealerts Admin',
      });
      cleanup.roleIds.push(role.id);

      await rbacService.assignRoleToEmployee({
        organizationId: organization.id,
        employeeId: employee.id,
        roleId: role.id,
      });

      const activeCustomer = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: `C-${shortCode}`,
          type: 'INDIVIDUAL',
          firstName: 'Customer',
          lastName: 'Active',
          status: 'ACTIVE',
        },
      });
      const suspendedCustomer = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: `S-${shortCode}`,
          type: 'INDIVIDUAL',
          firstName: 'Customer',
          lastName: 'Suspended',
          status: 'SUSPENDED',
        },
      });
      const otherTenantCustomer = await prisma.customer.create({
        data: {
          organizationId: otherOrganization.id,
          customerCode: `O-${shortCode}`,
          type: 'INDIVIDUAL',
          firstName: 'Other',
          lastName: 'Tenant',
          status: 'ACTIVE',
        },
      });
      cleanup.customerIds.push(
        activeCustomer.id,
        suspendedCustomer.id,
        otherTenantCustomer.id,
      );

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

      await request(server).get('/prealerts').expect(401);
      await request(server)
        .get('/prealerts')
        .set('Cookie', sessionCookie)
        .expect(403);

      const readPermission = await prisma.permission.findUniqueOrThrow({
        where: { code: 'prealerts.read' },
        select: { id: true },
      });
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: readPermission.id,
        },
      });

      const emptyListResponse = await request(server)
        .get('/prealerts?page=1&pageSize=10')
        .set('Cookie', sessionCookie)
        .expect(200);
      expect(emptyListResponse.headers['cache-control']).toBe('no-store');
      expect(emptyListResponse.body).toMatchObject({
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      });

      await request(server)
        .post('/prealerts')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: '1Z999AA10123456784',
          storeName: 'Amazon',
          description: 'Portable SSD',
          quantity: 1,
          declaredValue: '129.99',
        })
        .expect(403);

      const managePermission = await prisma.permission.findUniqueOrThrow({
        where: { code: 'prealerts.manage' },
        select: { id: true },
      });
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: managePermission.id,
        },
      });

      const createResponse = await request(server)
        .post('/prealerts')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: ' 1Z-999-AA1-01-2345-6784 ',
          carrierName: '  UPS ',
          storeName: ' Amazon ',
          purchaseDate: '2026-07-01',
          description: ' Portable SSD ',
          quantity: 2,
          declaredValue: '129.99',
          invoiceStatus: 'PENDING',
          notes: ' Expected in Miami warehouse ',
        })
        .expect(201);
      const createdPrealert = createResponse.body as PrealertHttpRecord;
      cleanup.prealertIds.push(createdPrealert.id);

      expect(createdPrealert).toMatchObject({
        externalTrackingNumber: '1Z-999-AA1-01-2345-6784',
        carrierName: 'UPS',
        storeName: 'Amazon',
        description: 'Portable SSD',
        quantity: 2,
        declaredValue: '129.99',
        currencyCode: 'DOP',
        invoiceStatus: 'PENDING',
        status: 'PENDING_ARRIVAL',
      });
      expect(String(createdPrealert.prealertCode)).toMatch(
        /^PA[A-HJ-NP-Z2-9]{10}$/,
      );
      expect(createdPrealert).not.toHaveProperty('organizationId');
      expect(createdPrealert).not.toHaveProperty(
        'externalTrackingNumberNormalized',
      );
      expect(createdPrealert).not.toHaveProperty('createdByEmployeeId');

      await request(server)
        .post('/prealerts')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: suspendedCustomer.id,
          externalTrackingNumber: 'LX123456789US',
          storeName: 'Amazon',
          description: 'Rejected customer',
          quantity: 1,
          declaredValue: '10.00',
        })
        .expect(409);

      await request(server)
        .post('/prealerts')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: otherTenantCustomer.id,
          externalTrackingNumber: 'LX123456789US',
          storeName: 'Amazon',
          description: 'Foreign customer',
          quantity: 1,
          declaredValue: '10.00',
        })
        .expect(404);

      await request(server)
        .post('/prealerts')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: '1Z999AA10123456784',
          storeName: 'Amazon',
          description: 'Duplicate tracking',
          quantity: 1,
          declaredValue: '129.99',
        })
        .expect(409);

      const listResponse = await request(server)
        .get(
          '/prealerts?page=1&pageSize=10&q=portable&status=PENDING_ARRIVAL&invoiceStatus=PENDING',
        )
        .set('Cookie', sessionCookie)
        .expect(200);
      const listBody = listResponse.body as PrealertListHttpResponse;
      expect(listBody.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });

      const detailResponse = await request(server)
        .get(`/prealerts/${createdPrealert.id}`)
        .set('Cookie', sessionCookie)
        .expect(200);
      const detailBody = detailResponse.body as PrealertHttpRecord & {
        createdBy: {
          id: string;
          displayName: string;
        };
      };
      expect(detailBody).toMatchObject({
        id: createdPrealert.id,
        notes: 'Expected in Miami warehouse',
        cancellationReason: null,
      });
      expect(detailBody).not.toHaveProperty('organizationId');
      expect(detailBody.createdBy).toMatchObject({
        id: employee.id,
        displayName: 'Ada Lovelace',
      });

      const updateResponse = await request(server)
        .patch(`/prealerts/${createdPrealert.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          externalTrackingNumber: ' 9400-1111-1111-1111-1111-11 ',
          storeName: ' Best Buy ',
          description: ' Portable SSD updated ',
          invoiceStatus: 'PROVIDED',
          notes: 'Updated notes',
        })
        .expect(200);
      expect(updateResponse.body).toMatchObject({
        externalTrackingNumber: '9400-1111-1111-1111-1111-11',
        storeName: 'Best Buy',
        description: 'Portable SSD updated',
        invoiceStatus: 'PROVIDED',
      });

      const cancelResponse = await request(server)
        .post(`/prealerts/${createdPrealert.id}/cancel`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          reason: '  La compra fue cancelada por el cliente.  ',
        })
        .expect(200);
      expect(cancelResponse.body).toMatchObject({
        status: 'CANCELLED',
        cancellationReason: 'La compra fue cancelada por el cliente.',
      });

      const auditCountAfterFirstCancel = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'PREALERT',
          entityId: String(createdPrealert.id),
          action: 'prealert.cancelled',
        },
      });
      const outboxCountAfterFirstCancel = await prisma.outboxEvent.count({
        where: {
          organizationId: organization.id,
          aggregateType: 'PREALERT',
          aggregateId: String(createdPrealert.id),
          eventType: 'prealert.cancelled',
        },
      });

      await request(server)
        .post(`/prealerts/${createdPrealert.id}/cancel`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          reason: 'La compra fue cancelada por el cliente.',
        })
        .expect(200);

      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'PREALERT',
            entityId: String(createdPrealert.id),
            action: 'prealert.cancelled',
          },
        }),
      ).toBe(auditCountAfterFirstCancel);
      expect(
        await prisma.outboxEvent.count({
          where: {
            organizationId: organization.id,
            aggregateType: 'PREALERT',
            aggregateId: String(createdPrealert.id),
            eventType: 'prealert.cancelled',
          },
        }),
      ).toBe(outboxCountAfterFirstCancel);

      await request(server)
        .patch(`/prealerts/${createdPrealert.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          description: 'Should not update',
        })
        .expect(409);

      const recreateResponse = await request(server)
        .post('/prealerts')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: '9400111111111111111111',
          storeName: 'Best Buy',
          description: 'Replacement prealert',
          quantity: 1,
          declaredValue: '20.00',
        })
        .expect(201);
      const recreatedPrealert = recreateResponse.body as PrealertHttpRecord;
      cleanup.prealertIds.push(recreatedPrealert.id);

      const foreignPrealert = await prisma.prealert.create({
        data: {
          organizationId: otherOrganization.id,
          customerId: otherTenantCustomer.id,
          createdByEmployeeId: otherEmployee.id,
          prealertCode: 'PA7KMP4TX9RW',
          externalTrackingNumber: 'LX123456789US',
          externalTrackingNumberNormalized: 'LX123456789US',
          storeName: 'Amazon',
          description: 'Foreign',
          quantity: 1,
          declaredValue: '10.00',
          currencyCode: 'USD',
          invoiceStatus: 'PENDING',
          status: 'PENDING_ARRIVAL',
        },
      });
      cleanup.prealertIds.push(foreignPrealert.id);

      await request(server)
        .get(`/prealerts/${foreignPrealert.id}`)
        .set('Cookie', sessionCookie)
        .expect(404);
    } finally {
      if (prismaService) {
        if (cleanup.prealertIds.length > 0) {
          await prismaService.prealert.deleteMany({
            where: {
              id: {
                in: cleanup.prealertIds,
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
        if (cleanup.customerIds.length > 0) {
          await prismaService.customer.deleteMany({
            where: {
              id: {
                in: cleanup.customerIds,
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
          await deleteAuditArtifactsForOrganizations(
            prismaService,
            cleanup.organizationIds,
          );
          await prismaService.organizationSettings.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
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
