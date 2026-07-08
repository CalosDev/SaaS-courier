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
import {
  deleteAuditArtifactsForOrganizations,
  deleteInventoryArtifactsForOrganizations,
} from './audit-test-cleanup';

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

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('serves inventory endpoints with tenant-safe permissions, safe responses and idempotent movements', async () => {
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

      await request(server).get('/inventory/locations').expect(401);
      await request(server)
        .get('/inventory/locations')
        .set('Cookie', sessionCookie)
        .expect(403);

      const inventoryReadPermission = await prisma.permission.findUniqueOrThrow(
        {
          where: { code: 'inventory.read' },
          select: { id: true },
        },
      );
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: inventoryReadPermission.id,
        },
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

      const inventoryManagePermission =
        await prisma.permission.findUniqueOrThrow({
          where: { code: 'inventory.manage' },
          select: { id: true },
        });
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: inventoryManagePermission.id,
        },
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
        await deleteAuditArtifactsForOrganizations(
          prismaService,
          cleanup.organizationIds,
        );
        await prismaService.packageReception.deleteMany({
          where: { packageId: { in: cleanup.packageIds } },
        });
        await prismaService.package.deleteMany({
          where: { id: { in: cleanup.packageIds } },
        });
        await prismaService.customer.deleteMany({
          where: { id: { in: cleanup.customerIds } },
        });
        await prismaService.userSession.deleteMany({
          where: { id: { in: cleanup.sessionIds } },
        });
        await prismaService.employeeRole.deleteMany({
          where: { employeeId: { in: cleanup.employeeIds } },
        });
        await prismaService.rolePermission.deleteMany({
          where: { roleId: { in: cleanup.roleIds } },
        });
        await prismaService.role.deleteMany({
          where: { id: { in: cleanup.roleIds } },
        });
        await prismaService.employeeFacility.deleteMany({
          where: { employeeId: { in: cleanup.employeeIds } },
        });
        await prismaService.employee.deleteMany({
          where: { id: { in: cleanup.employeeIds } },
        });
        await prismaService.facility.deleteMany({
          where: { id: { in: cleanup.facilityIds } },
        });
        await prismaService.user.deleteMany({
          where: { id: { in: cleanup.userIds } },
        });
        await prismaService.organizationSettings.deleteMany({
          where: { organizationId: { in: cleanup.organizationIds } },
        });
        await prismaService.organization.deleteMany({
          where: { id: { in: cleanup.organizationIds } },
        });
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
