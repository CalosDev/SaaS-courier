import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupCoreHttpTestData,
  configureHttpE2eEnvironment,
  createAuthenticatedHttpSession,
  createHttpE2eContext,
  fetchCsrfContext,
  grantPermission,
  HTTP_TEST_ORIGIN as ALLOWED_ORIGIN,
} from './http-e2e-test-kit';

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

describe('Packages admin HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    facilityIds: [] as string[],
    roleIds: [] as string[],
    customerIds: [] as string[],
    prealertIds: [] as string[],
    packageIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(configureHttpE2eEnvironment);

  it('serves create, list, detail, update and cancel with tenant-scoped permissions and safe responses', async () => {
    try {
      const httpContext = await createHttpE2eContext();
      moduleRef = httpContext.moduleRef;
      app = httpContext.app;
      const prisma = httpContext.prisma;
      prismaService = prisma;
      const {
        passwordHasher,
        rbacService,
        sessionsService,
        authCookieService,
      } = httpContext;

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

      const receptionFacility = await prisma.facility.create({
        data: {
          organizationId: organization.id,
          code: `MIA-${shortCode}`,
          name: 'Miami Origin',
          type: 'INTERNATIONAL_WAREHOUSE',
          isPackageOrigin: true,
          isActive: true,
        },
      });
      cleanup.facilityIds.push(receptionFacility.id);
      await prisma.employeeFacility.create({
        data: {
          organizationId: organization.id,
          employeeId: employee.id,
          facilityId: receptionFacility.id,
          isPrimary: true,
        },
      });

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

      const session = await createAuthenticatedHttpSession({
        sessionsService,
        authCookieService,
        userId: user.id,
        organizationId: organization.id,
      });
      cleanup.sessionIds.push(session.sessionId);

      const sessionCookie = session.sessionCookie;
      const server = httpContext.server;
      const csrfContext = await fetchCsrfContext({
        server,
        authCookieService,
      });
      const csrfBody = { csrfToken: csrfContext.csrfToken };
      const csrfCookie = csrfContext.csrfCookie;

      await request(server).get('/packages').expect(401);
      await request(server)
        .get('/packages')
        .set('Cookie', sessionCookie)
        .expect(403);

      await grantPermission({
        prisma,
        organizationId: organization.id,
        roleId: role.id,
        permissionCode: 'packages.read',
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

      await grantPermission({
        prisma,
        organizationId: organization.id,
        roleId: role.id,
        permissionCode: 'packages.manage',
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

      const receptionBody = {
        facilityId: receptionFacility.id,
        weight: 12.5,
        length: 10,
        width: 8,
        height: 6,
        pieceCount: 1,
        condition: 'SEALED',
      };

      await request(server)
        .post(`/packages/${createdManualPackage.id}/receive`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send(receptionBody)
        .expect(403);

      const receivePermission = await prisma.permission.findUniqueOrThrow({
        where: { code: 'packages.receive' },
        select: { id: true },
      });
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: receivePermission.id,
        },
      });

      await request(server)
        .get(`/packages/${createdManualPackage.id}/reception`)
        .set('Cookie', sessionCookie)
        .expect(404);

      const receiveResponse = await request(server)
        .post(`/packages/${createdManualPackage.id}/receive`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send(receptionBody)
        .expect(200);
      expect(receiveResponse.headers['cache-control']).toBe('no-store');
      expect(receiveResponse.body).toMatchObject({
        packageId: createdManualPackage.id,
        facility: { id: receptionFacility.id, code: `MIA-${shortCode}` },
        receivedBy: { id: employee.id, displayName: 'Ada Lovelace' },
        weight: '12.500',
        weightUnit: 'LB',
        length: '10.00',
        width: '8.00',
        height: '6.00',
        dimensionUnit: 'IN',
        pieceCount: 1,
        condition: 'SEALED',
      });
      expect(receiveResponse.body).not.toHaveProperty('organizationId');
      expect(receiveResponse.body).not.toHaveProperty('receivedByEmployeeId');

      await request(server)
        .post(`/packages/${createdManualPackage.id}/receive`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send(receptionBody)
        .expect(200);

      await request(server)
        .post(`/packages/${createdManualPackage.id}/receive`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({ ...receptionBody, weight: 13 })
        .expect(409);

      const receptionResponse = await request(server)
        .get(`/packages/${createdManualPackage.id}/reception`)
        .set('Cookie', sessionCookie)
        .expect(200);
      const receiveResponseBody = receiveResponse.body as { id: string };
      const receptionResponseBody = receptionResponse.body as { id: string };
      expect(receptionResponseBody.id).toBe(receiveResponseBody.id);

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

      await request(server)
        .post(`/packages/${foreignPackage.id}/receive`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send(receptionBody)
        .expect(404);
    } finally {
      if (prismaService) {
        if (cleanup.packageIds.length > 0) {
          await prismaService.packageReception.deleteMany({
            where: { packageId: { in: cleanup.packageIds } },
          });
        }
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
        await cleanupCoreHttpTestData(prismaService, cleanup);
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
