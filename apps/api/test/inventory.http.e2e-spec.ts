import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { deleteInventoryArtifactsForOrganizations } from './audit-test-cleanup';
import {
  cleanupCoreHttpTestData,
  configureHttpE2eEnvironment,
  createAuthenticatedHttpSession,
  createHttpE2eContext,
  fetchCsrfContext,
  grantPermission,
  HTTP_TEST_ORIGIN as ALLOWED_ORIGIN,
} from './http-e2e-test-kit';

describe('Inventory admin HTTP', () => {
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
    packageIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(configureHttpE2eEnvironment);

  it('serves inventory endpoints with tenant-safe permissions, safe responses and idempotent movements', async () => {
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
          legalName: `Inventory HTTP ${suffix}`,
          commercialName: `Inventory HTTP ${suffix}`,
          slug: `inventory-http-${suffix}`,
          status: 'ACTIVE',
        },
      });
      const otherOrganization = await prisma.organization.create({
        data: {
          legalName: `Inventory Other ${suffix}`,
          commercialName: `Inventory Other ${suffix}`,
          slug: `inventory-http-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id, otherOrganization.id);
      await prisma.organizationSettings.createMany({
        data: [
          { organizationId: organization.id },
          { organizationId: otherOrganization.id },
        ],
      });

      const [user, otherUser] = await Promise.all([
        prisma.user.create({
          data: {
            email: `inventory-http.${suffix}@courier.test`,
            passwordHash,
            passwordChangedAt: new Date('2026-07-07T00:00:00.000Z'),
            emailVerifiedAt: new Date('2026-07-07T00:00:00.000Z'),
            status: 'ACTIVE',
          },
        }),
        prisma.user.create({
          data: {
            email: `inventory-http.other.${suffix}@courier.test`,
            passwordHash,
            passwordChangedAt: new Date('2026-07-07T00:00:00.000Z'),
            emailVerifiedAt: new Date('2026-07-07T00:00:00.000Z'),
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.userIds.push(user.id, otherUser.id);

      const [employee, otherEmployee] = await Promise.all([
        prisma.employee.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            employeeCode: `INV-${shortCode}`,
            firstName: 'Ada',
            lastName: 'Lovelace',
            status: 'ACTIVE',
          },
        }),
        prisma.employee.create({
          data: {
            organizationId: otherOrganization.id,
            userId: otherUser.id,
            employeeCode: `INV-OTHER-${shortCode}`,
            firstName: 'Grace',
            lastName: 'Hopper',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.employeeIds.push(employee.id, otherEmployee.id);

      const [originFacility, secondaryFacility, foreignFacility] =
        await Promise.all([
          prisma.facility.create({
            data: {
              organizationId: organization.id,
              code: `MIA-${shortCode}`,
              name: 'Miami Inventory',
              type: 'INTERNATIONAL_WAREHOUSE',
              isPackageOrigin: true,
              isActive: true,
            },
          }),
          prisma.facility.create({
            data: {
              organizationId: organization.id,
              code: `SDQ-${shortCode}`,
              name: 'Santo Domingo',
              type: 'DISTRIBUTION_CENTER',
              isPackageOrigin: false,
              isActive: true,
            },
          }),
          prisma.facility.create({
            data: {
              organizationId: otherOrganization.id,
              code: `OTH-${shortCode}`,
              name: 'Other Inventory',
              type: 'INTERNATIONAL_WAREHOUSE',
              isPackageOrigin: true,
              isActive: true,
            },
          }),
        ]);
      cleanup.facilityIds.push(
        originFacility.id,
        secondaryFacility.id,
        foreignFacility.id,
      );
      await prisma.employeeFacility.create({
        data: {
          organizationId: organization.id,
          employeeId: employee.id,
          facilityId: originFacility.id,
          isPrimary: true,
        },
      });
      await prisma.employeeFacility.create({
        data: {
          organizationId: otherOrganization.id,
          employeeId: otherEmployee.id,
          facilityId: foreignFacility.id,
          isPrimary: true,
        },
      });

      const role = await rbacService.createRole({
        organizationId: organization.id,
        code: `INVENTORY_${shortCode}`,
        name: 'Inventory Manager',
      });
      cleanup.roleIds.push(role.id);
      await rbacService.assignRoleToEmployee({
        organizationId: organization.id,
        employeeId: employee.id,
        roleId: role.id,
      });

      const [customer, otherCustomer] = await Promise.all([
        prisma.customer.create({
          data: {
            organizationId: organization.id,
            customerCode: `INV-CUST-${shortCode}`,
            type: 'INDIVIDUAL',
            firstName: 'Inventory',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
        prisma.customer.create({
          data: {
            organizationId: otherOrganization.id,
            customerCode: `OTH-CUST-${shortCode}`,
            type: 'INDIVIDUAL',
            firstName: 'Other',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.customerIds.push(customer.id, otherCustomer.id);

      const [receivedPackage, pendingPackage, foreignPackage] =
        await Promise.all([
          createPackageWithReception({
            prisma,
            organizationId: organization.id,
            customerId: customer.id,
            employeeId: employee.id,
            facilityId: originFacility.id,
            externalTrackingNumber: `INV-HTTP-${suffix}-01`,
          }),
          prisma.package.create({
            data: {
              organizationId: organization.id,
              customerId: customer.id,
              registeredByEmployeeId: employee.id,
              internalTrackingNumber: buildPackageCode(),
              externalTrackingNumber: `INV-HTTP-${suffix}-02`,
              externalTrackingNumberNormalized: normalizeTracking(
                `INV-HTTP-${suffix}-02`,
              ),
              status: 'RECEPTION_PENDING',
            },
          }),
          createPackageWithReception({
            prisma,
            organizationId: otherOrganization.id,
            customerId: otherCustomer.id,
            employeeId: otherEmployee.id,
            facilityId: foreignFacility.id,
            externalTrackingNumber: `INV-HTTP-${suffix}-03`,
          }),
        ]);
      cleanup.packageIds.push(
        receivedPackage.id,
        pendingPackage.id,
        foreignPackage.id,
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

      await request(server).get('/inventory/locations').expect(401);
      await request(server)
        .get('/inventory/locations')
        .set('Cookie', sessionCookie)
        .expect(403);

      await grantPermission({
        prisma,
        organizationId: organization.id,
        roleId: role.id,
        permissionCode: 'inventory.read',
      });

      const emptyLocationsResponse = await request(server)
        .get('/inventory/locations?page=1&pageSize=10')
        .set('Cookie', sessionCookie)
        .expect(200);
      expect(emptyLocationsResponse.headers['cache-control']).toBe('no-store');
      expect(emptyLocationsResponse.body).toMatchObject({
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      });

      await request(server)
        .post('/inventory/locations')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          facilityId: originFacility.id,
          code: 'A-01',
          name: 'Rack A-01',
          type: 'SHELF',
        })
        .expect(403);

      await grantPermission({
        prisma,
        organizationId: organization.id,
        roleId: role.id,
        permissionCode: 'inventory.manage',
      });

      const createLocationResponse = await request(server)
        .post('/inventory/locations')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          facilityId: originFacility.id,
          code: ' a-01 ',
          name: ' Rack A-01 ',
          type: 'SHELF',
          description: ' Primary shelf ',
        })
        .expect(201);
      expect(createLocationResponse.headers['cache-control']).toBe('no-store');
      expect(createLocationResponse.body).toMatchObject({
        facility: { id: originFacility.id, code: `MIA-${shortCode}` },
        code: 'A-01',
        name: 'Rack A-01',
        type: 'SHELF',
        description: 'Primary shelf',
        isActive: true,
      });
      expect(createLocationResponse.body).not.toHaveProperty('organizationId');
      expect(createLocationResponse.body).not.toHaveProperty('facilityId');
      const createdLocation = createLocationResponse.body as { id: string };

      await request(server)
        .post('/inventory/locations')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          facilityId: originFacility.id,
          code: 'A-01',
          name: 'Duplicate Rack',
          type: 'SHELF',
        })
        .expect(409);

      const updateLocationResponse = await request(server)
        .patch(`/inventory/locations/${createdLocation.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          name: 'Rack A-01 Updated',
          isActive: false,
        })
        .expect(200);
      expect(updateLocationResponse.body).toMatchObject({
        id: createdLocation.id,
        name: 'Rack A-01 Updated',
        isActive: false,
      });

      const activeLocationResponse = await request(server)
        .patch(`/inventory/locations/${createdLocation.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          isActive: true,
        })
        .expect(200);
      expect(activeLocationResponse.body).toMatchObject({
        id: createdLocation.id,
        isActive: true,
      });

      const crossFacilityLocation = await prisma.warehouseLocation.create({
        data: {
          organizationId: organization.id,
          facilityId: secondaryFacility.id,
          code: 'SDQ-01',
          name: 'Secondary Rack',
          type: 'SHELF',
          isActive: true,
        },
      });
      const foreignLocation = await prisma.warehouseLocation.create({
        data: {
          organizationId: otherOrganization.id,
          facilityId: foreignFacility.id,
          code: 'OTH-01',
          name: 'Foreign Rack',
          type: 'SHELF',
          isActive: true,
        },
      });

      const packagesResponse = await request(server)
        .get('/inventory/packages?page=1&pageSize=10')
        .set('Cookie', sessionCookie)
        .expect(200);
      const packagesBody = packagesResponse.body as {
        pagination: {
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
        };
        items: Array<{
          id: string;
          status: string;
          customer: {
            id: string;
          };
          currentPosition: unknown;
        }>;
      };
      expect(packagesResponse.headers['cache-control']).toBe('no-store');
      expect(packagesBody.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(packagesBody.items[0]).toMatchObject({
        id: receivedPackage.id,
        status: 'RECEIVED_AT_ORIGIN',
        customer: {
          id: customer.id,
        },
        currentPosition: null,
      });

      const firstMoveResponse = await request(server)
        .post(`/inventory/packages/${receivedPackage.id}/move`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          movementType: 'PUTAWAY',
          toLocationId: createdLocation.id,
          note: 'Initial placement',
        })
        .expect(200);
      expect(firstMoveResponse.headers['cache-control']).toBe('no-store');
      expect(firstMoveResponse.body).toMatchObject({
        id: receivedPackage.id,
        currentPosition: {
          location: {
            id: createdLocation.id,
            code: 'A-01',
          },
        },
      });
      expect(firstMoveResponse.body).not.toHaveProperty('organizationId');

      await request(server)
        .post(`/inventory/packages/${receivedPackage.id}/move`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          movementType: 'PUTAWAY',
          toLocationId: createdLocation.id,
          note: 'Initial placement',
        })
        .expect(200);
      expect(
        await prisma.inventoryMovement.count({
          where: {
            organizationId: organization.id,
            packageId: receivedPackage.id,
          },
        }),
      ).toBe(1);

      const movementsResponse = await request(server)
        .get(`/inventory/packages/${receivedPackage.id}/movements`)
        .set('Cookie', sessionCookie)
        .expect(200);
      const movementsBody = movementsResponse.body as {
        items: Array<{
          packageId: string;
          movementType: string;
          movedBy: {
            id: string;
            displayName: string;
          };
        }>;
      };
      expect(movementsResponse.headers['cache-control']).toBe('no-store');
      expect(movementsBody.items).toHaveLength(1);
      expect(movementsBody.items[0]).toMatchObject({
        packageId: receivedPackage.id,
        movementType: 'PUTAWAY',
        movedBy: {
          id: employee.id,
          displayName: 'Ada Lovelace',
        },
      });

      await request(server)
        .post(`/inventory/packages/${pendingPackage.id}/move`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          movementType: 'PUTAWAY',
          toLocationId: createdLocation.id,
        })
        .expect(409);

      await request(server)
        .post(`/inventory/packages/${receivedPackage.id}/move`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          movementType: 'MOVE',
          toLocationId: crossFacilityLocation.id,
        })
        .expect(409);

      await request(server)
        .post(`/inventory/packages/${receivedPackage.id}/move`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          movementType: 'MOVE',
          toLocationId: foreignLocation.id,
        })
        .expect(404);

      await request(server)
        .post(`/inventory/packages/${foreignPackage.id}/move`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          movementType: 'PUTAWAY',
          toLocationId: createdLocation.id,
        })
        .expect(404);

      await request(server)
        .get(`/inventory/packages/${foreignPackage.id}/movements`)
        .set('Cookie', sessionCookie)
        .expect(404);
    } finally {
      if (prismaService) {
        await deleteInventoryArtifactsForOrganizations(
          prismaService,
          cleanup.organizationIds,
        );
        await prismaService.packageReception.deleteMany({
          where: { packageId: { in: cleanup.packageIds } },
        });
        await prismaService.package.deleteMany({
          where: { id: { in: cleanup.packageIds } },
        });
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

async function createPackageWithReception(input: {
  prisma: PrismaService;
  organizationId: string;
  customerId: string;
  employeeId: string;
  facilityId: string;
  externalTrackingNumber: string;
}) {
  const packageRecord = await input.prisma.package.create({
    data: {
      organizationId: input.organizationId,
      customerId: input.customerId,
      registeredByEmployeeId: input.employeeId,
      internalTrackingNumber: buildPackageCode(),
      externalTrackingNumber: input.externalTrackingNumber,
      externalTrackingNumberNormalized: normalizeTracking(
        input.externalTrackingNumber,
      ),
      status: 'RECEIVED_AT_ORIGIN',
    },
  });

  await input.prisma.packageReception.create({
    data: {
      organizationId: input.organizationId,
      packageId: packageRecord.id,
      facilityId: input.facilityId,
      receivedByEmployeeId: input.employeeId,
      weight: '10.000',
      weightUnit: 'LB',
      length: '10.00',
      width: '8.00',
      height: '6.00',
      dimensionUnit: 'IN',
      pieceCount: 1,
      condition: 'SEALED',
    },
  });

  return packageRecord;
}

function buildPackageCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'PK';

  while (value.length < 14) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}

function normalizeTracking(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
