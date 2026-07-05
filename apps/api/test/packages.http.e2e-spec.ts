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

type PackageHttpRecord = {
  id: string;
  internalTrackingNumber: string;
  externalTrackingNumber: string;
  status: string;
  source: 'MANUAL' | 'PREALERT';
  notes?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  customer: {
    id: string;
    customerCode: string;
    type: 'INDIVIDUAL' | 'BUSINESS';
    displayName: string;
  };
  prealert: {
    id: string;
    prealertCode: string;
    storeName: string;
  } | null;
  registeredBy?: {
    id: string;
    displayName: string;
  };
  cancelledBy?: {
    id: string;
    displayName: string;
  } | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
};

type PackageListHttpResponse = {
  items: PackageHttpRecord[];
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

describe('Packages admin HTTP', () => {
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
    packageIds: [] as string[],
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
          legalName: `Packages Org ${suffix}`,
          commercialName: `Packages Org ${suffix}`,
          slug: `packages-http-${suffix}`,
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
          legalName: `Packages Other ${suffix}`,
          commercialName: `Packages Other ${suffix}`,
          slug: `packages-http-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(otherOrganization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: otherOrganization.id },
      });

      const user = await prisma.user.create({
        data: {
          email: `packages-http.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-03T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-03T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);
      const otherUser = await prisma.user.create({
        data: {
          email: `packages-http.other.${suffix}@courier.test`,
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
        code: `PACKAGES_${shortCode}`,
        name: 'Packages Admin',
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
      const secondActiveCustomer = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: `C2-${shortCode}`,
          type: 'INDIVIDUAL',
          firstName: 'Customer',
          lastName: 'Updated',
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
        secondActiveCustomer.id,
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

      await request(server).get('/packages').expect(401);
      await request(server)
        .get('/packages')
        .set('Cookie', sessionCookie)
        .expect(403);

      const readPermission = await prisma.permission.findUniqueOrThrow({
        where: { code: 'packages.read' },
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
        .get('/packages?page=1&pageSize=10')
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
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: '1Z999AA10123456784',
        })
        .expect(403);

      const managePermission = await prisma.permission.findUniqueOrThrow({
        where: { code: 'packages.manage' },
        select: { id: true },
      });
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: managePermission.id,
        },
      });

      await request(server)
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: '1Z999AA10123456784',
          internalTrackingNumber: 'PKFORBIDDEN1234',
        })
        .expect(400);

      const createManualResponse = await request(server)
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: ' 1Z-999-AA1-01-2345-6784 ',
          notes: ' First package registration ',
        })
        .expect(201);
      const createdManualPackage =
        createManualResponse.body as PackageHttpRecord;
      cleanup.packageIds.push(createdManualPackage.id);

      expect(createdManualPackage).toMatchObject({
        externalTrackingNumber: '1Z-999-AA1-01-2345-6784',
        status: 'RECEPTION_PENDING',
        source: 'MANUAL',
      });
      expect(createdManualPackage.internalTrackingNumber).toMatch(
        /^PK[A-HJ-NP-Z2-9]{12}$/,
      );
      expect(createdManualPackage).not.toHaveProperty('organizationId');
      expect(createdManualPackage).not.toHaveProperty(
        'externalTrackingNumberNormalized',
      );
      expect(createdManualPackage).not.toHaveProperty('registeredByEmployeeId');

      await request(server)
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: suspendedCustomer.id,
          externalTrackingNumber: 'LX123456789US',
        })
        .expect(409);

      await request(server)
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: otherTenantCustomer.id,
          externalTrackingNumber: 'LX123456789US',
        })
        .expect(404);

      const manualDetailResponse = await request(server)
        .get(`/packages/${createdManualPackage.id}`)
        .set('Cookie', sessionCookie)
        .expect(200);
      const manualDetail = manualDetailResponse.body as PackageHttpRecord;
      expect(manualDetail).toMatchObject({
        id: createdManualPackage.id,
        notes: 'First package registration',
        cancellationReason: null,
      });
      expect(manualDetail.registeredBy).toMatchObject({
        id: employee.id,
        displayName: 'Ada Lovelace',
      });

      const updateManualResponse = await request(server)
        .patch(`/packages/${createdManualPackage.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: secondActiveCustomer.id,
          externalTrackingNumber: ' 9400-1111-1111-1111-1111-11 ',
          notes: ' Updated package notes ',
        })
        .expect(200);
      expect(updateManualResponse.body).toMatchObject({
        externalTrackingNumber: '9400-1111-1111-1111-1111-11',
        notes: 'Updated package notes',
        customer: {
          id: secondActiveCustomer.id,
        },
      });

      const pendingPrealert = await prisma.prealert.create({
        data: {
          organizationId: organization.id,
          customerId: activeCustomer.id,
          createdByEmployeeId: employee.id,
          prealertCode: buildCode('PA', 10),
          externalTrackingNumber: 'LX-123-456-789-US',
          externalTrackingNumberNormalized: 'LX123456789US',
          storeName: 'Amazon',
          description: 'Pending prealert',
          quantity: 1,
          declaredValue: '20.00',
          currencyCode: 'USD',
          invoiceStatus: 'PENDING',
          status: 'PENDING_ARRIVAL',
        },
      });
      cleanup.prealertIds.push(pendingPrealert.id);

      await request(server)
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: activeCustomer.id,
          externalTrackingNumber: 'LX-123-456-789-US',
        })
        .expect(409);

      const matchedPrealert = await prisma.prealert.create({
        data: {
          organizationId: organization.id,
          customerId: activeCustomer.id,
          createdByEmployeeId: employee.id,
          prealertCode: buildCode('PA', 10),
          externalTrackingNumber: '9400-2222-2222-2222-2222-22',
          externalTrackingNumberNormalized: '9400222222222222222222',
          storeName: 'Best Buy',
          description: 'Matched prealert',
          quantity: 1,
          declaredValue: '30.00',
          currencyCode: 'USD',
          invoiceStatus: 'PENDING',
          status: 'PENDING_ARRIVAL',
        },
      });
      cleanup.prealertIds.push(matchedPrealert.id);

      const createFromPrealertResponse = await request(server)
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          prealertId: matchedPrealert.id,
          notes: ' From prealert flow ',
        })
        .expect(201);
      const createdMatchedPackage =
        createFromPrealertResponse.body as PackageHttpRecord;
      cleanup.packageIds.push(createdMatchedPackage.id);

      expect(createdMatchedPackage).toMatchObject({
        externalTrackingNumber: '9400-2222-2222-2222-2222-22',
        source: 'PREALERT',
        status: 'RECEPTION_PENDING',
        prealert: {
          id: matchedPrealert.id,
          prealertCode: matchedPrealert.prealertCode,
          storeName: 'Best Buy',
        },
      });

      const matchedPrealertState = await prisma.prealert.findUniqueOrThrow({
        where: { id: matchedPrealert.id },
        select: { status: true },
      });
      expect(matchedPrealertState.status).toBe('MATCHED');

      const listResponse = await request(server)
        .get('/packages?page=1&pageSize=10&q=9400&source=PREALERT')
        .set('Cookie', sessionCookie)
        .expect(200);
      const listBody = listResponse.body as PackageListHttpResponse;
      expect(listBody.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(listBody.items[0]?.id).toBe(createdMatchedPackage.id);

      await request(server)
        .post('/packages')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          prealertId: matchedPrealert.id,
        })
        .expect(409);

      await request(server)
        .patch(`/packages/${createdMatchedPackage.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId: secondActiveCustomer.id,
        })
        .expect(409);

      const updateLinkedResponse = await request(server)
        .patch(`/packages/${createdMatchedPackage.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          notes: ' Linked package notes updated ',
        })
        .expect(200);
      expect(updateLinkedResponse.body).toMatchObject({
        notes: 'Linked package notes updated',
        source: 'PREALERT',
      });

      const packageCancelledAuditCount = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'PACKAGE',
          entityId: createdMatchedPackage.id,
          action: 'package.cancelled',
        },
      });
      const prealertReopenedAuditCount = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'PREALERT',
          entityId: matchedPrealert.id,
          action: 'prealert.reopened',
        },
      });

      const cancelResponse = await request(server)
        .post(`/packages/${createdMatchedPackage.id}/cancel`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          reason: '  Duplicate registration during review  ',
        })
        .expect(200);
      expect(cancelResponse.body).toMatchObject({
        status: 'CANCELLED',
        cancellationReason: 'Duplicate registration during review',
      });

      const reopenedPrealert = await prisma.prealert.findUniqueOrThrow({
        where: { id: matchedPrealert.id },
        select: { status: true },
      });
      expect(reopenedPrealert.status).toBe('PENDING_ARRIVAL');

      const secondCancelResponse = await request(server)
        .post(`/packages/${createdMatchedPackage.id}/cancel`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          reason: 'Duplicate registration during review',
        })
        .expect(200);
      expect(secondCancelResponse.body).toMatchObject({
        status: 'CANCELLED',
      });

      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'PACKAGE',
            entityId: createdMatchedPackage.id,
            action: 'package.cancelled',
          },
        }),
      ).toBe(packageCancelledAuditCount + 1);
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'PREALERT',
            entityId: matchedPrealert.id,
            action: 'prealert.reopened',
          },
        }),
      ).toBe(prealertReopenedAuditCount + 1);

      const foreignPackage = await prisma.package.create({
        data: {
          organizationId: otherOrganization.id,
          customerId: otherTenantCustomer.id,
          registeredByEmployeeId: otherEmployee.id,
          internalTrackingNumber: buildCode('PK', 12),
          externalTrackingNumber: 'ZX-999-OTHER-TRACKING',
          externalTrackingNumberNormalized: 'ZX999OTHERTRACKING',
          status: 'RECEPTION_PENDING',
        },
      });
      cleanup.packageIds.push(foreignPackage.id);

      await request(server)
        .get(`/packages/${foreignPackage.id}`)
        .set('Cookie', sessionCookie)
        .expect(404);
    } finally {
      if (prismaService) {
        if (cleanup.packageIds.length > 0) {
          await prismaService.package.deleteMany({
            where: {
              id: {
                in: cleanup.packageIds,
              },
            },
          });
        }
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

function buildCode(prefix: 'PA' | 'PK', length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = prefix;

  while (value.length < prefix.length + length) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}
