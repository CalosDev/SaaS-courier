import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { PrismaAuditOutboxWriter } from '../src/audit/prisma-audit-outbox.writer';
import {
  InventoryMovementConflictError,
  WarehouseLocationCodeConflictError,
} from '../src/inventory/inventory.errors';
import { PrismaInventoryRepository } from '../src/inventory/prisma-inventory.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import {
  deleteAuditArtifactsForOrganizations,
  deleteInventoryArtifactsForOrganizations,
} from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Inventory repository integration', () => {
  it('enforces tenant-safe locations and package movements with atomic audit/outbox writes', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      facilityIds: [] as string[],
      customerIds: [] as string[],
      packageIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;
      process.env.NODE_ENV = 'test';

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const repository = moduleRef.get(PrismaInventoryRepository);
      const suffix = randomUUID();
      const contextUserEmail = `inventory.repo.${suffix}@courier.test`;
      const foreignUserEmail = `inventory.repo.other.${suffix}@courier.test`;

      const organization = await prisma.organization.create({
        data: {
          legalName: `Inventory Org ${suffix}`,
          commercialName: `Inventory Org ${suffix}`,
          slug: `inventory-org-${suffix}`,
          status: 'ACTIVE',
        },
      });
      const otherOrganization = await prisma.organization.create({
        data: {
          legalName: `Inventory Other ${suffix}`,
          commercialName: `Inventory Other ${suffix}`,
          slug: `inventory-other-${suffix}`,
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

      const [user, foreignUser] = await Promise.all([
        prisma.user.create({
          data: { email: contextUserEmail, status: 'ACTIVE' },
        }),
        prisma.user.create({
          data: { email: foreignUserEmail, status: 'ACTIVE' },
        }),
      ]);
      cleanup.userIds.push(user.id, foreignUser.id);

      const [employee, foreignEmployee] = await Promise.all([
        prisma.employee.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            firstName: 'Ada',
            lastName: 'Lovelace',
            status: 'ACTIVE',
          },
        }),
        prisma.employee.create({
          data: {
            organizationId: otherOrganization.id,
            userId: foreignUser.id,
            firstName: 'Grace',
            lastName: 'Hopper',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.employeeIds.push(employee.id, foreignEmployee.id);

      const [originFacility, secondaryFacility, foreignFacility] =
        await Promise.all([
          prisma.facility.create({
            data: {
              organizationId: organization.id,
              code: 'MIA-INV',
              name: 'Miami Inventory',
              type: 'INTERNATIONAL_WAREHOUSE',
              isPackageOrigin: true,
              isActive: true,
            },
          }),
          prisma.facility.create({
            data: {
              organizationId: organization.id,
              code: 'SDQ-INV',
              name: 'Santo Domingo Inventory',
              type: 'DISTRIBUTION_CENTER',
              isPackageOrigin: false,
              isActive: true,
            },
          }),
          prisma.facility.create({
            data: {
              organizationId: otherOrganization.id,
              code: 'OTH-INV',
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

      const [customer, foreignCustomer] = await Promise.all([
        prisma.customer.create({
          data: {
            organizationId: organization.id,
            customerCode: 'INV-CUST-1',
            type: 'INDIVIDUAL',
            firstName: 'Inventory',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
        prisma.customer.create({
          data: {
            organizationId: otherOrganization.id,
            customerCode: 'INV-CUST-2',
            type: 'INDIVIDUAL',
            firstName: 'Foreign',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.customerIds.push(customer.id, foreignCustomer.id);

      const [receivedPackage, rollbackPackage, pendingPackage, foreignPackage] =
        await Promise.all([
          createPackageWithReception({
            prisma,
            organizationId: organization.id,
            customerId: customer.id,
            employeeId: employee.id,
            facilityId: originFacility.id,
            externalTrackingNumber: `INV-${suffix}-01`,
          }),
          createPackageWithReception({
            prisma,
            organizationId: organization.id,
            customerId: customer.id,
            employeeId: employee.id,
            facilityId: originFacility.id,
            externalTrackingNumber: `INV-${suffix}-02`,
          }),
          prisma.package.create({
            data: {
              organizationId: organization.id,
              customerId: customer.id,
              registeredByEmployeeId: employee.id,
              internalTrackingNumber: buildPackageCode(),
              externalTrackingNumber: `INV-${suffix}-03`,
              externalTrackingNumberNormalized: normalizeTracking(
                `INV-${suffix}-03`,
              ),
              status: 'RECEPTION_PENDING',
            },
          }),
          createPackageWithReception({
            prisma,
            organizationId: otherOrganization.id,
            customerId: foreignCustomer.id,
            employeeId: foreignEmployee.id,
            facilityId: foreignFacility.id,
            externalTrackingNumber: `INV-${suffix}-04`,
          }),
        ]);
      cleanup.packageIds.push(
        receivedPackage.id,
        rollbackPackage.id,
        pendingPackage.id,
        foreignPackage.id,
      );

      const context = buildContext(organization.id, employee.id, user.id);

      const createdLocation = await repository.createLocation(
        {
          organizationId: organization.id,
          facilityId: originFacility.id,
          code: 'A-01',
          name: 'Rack A-01',
          type: 'SHELF',
          description: 'Primary shelf',
          isActive: true,
        },
        context,
      );

      expect(createdLocation).toMatchObject({
        organizationId: organization.id,
        facility: {
          id: originFacility.id,
        },
        code: 'A-01',
        type: 'SHELF',
      });
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            action: 'inventory.location.created',
            entityId: createdLocation.id,
          },
        }),
      ).toBe(1);
      expect(
        await prisma.outboxEvent.count({
          where: {
            organizationId: organization.id,
            eventType: 'inventory.location.created',
            aggregateId: createdLocation.id,
          },
        }),
      ).toBe(1);

      await expect(
        repository.createLocation(
          {
            organizationId: organization.id,
            facilityId: originFacility.id,
            code: 'A-01',
            name: 'Duplicate Rack',
            type: 'SHELF',
            description: null,
            isActive: true,
          },
          context,
        ),
      ).rejects.toBeInstanceOf(WarehouseLocationCodeConflictError);

      const holdLocation = await prisma.warehouseLocation.create({
        data: {
          organizationId: organization.id,
          facilityId: originFacility.id,
          code: 'HOLD-01',
          name: 'Hold Area',
          type: 'HOLD',
          isActive: true,
        },
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

      const putaway = await repository.movePackage(
        {
          organizationId: organization.id,
          packageId: receivedPackage.id,
          movedByEmployeeId: employee.id,
          movementType: 'PUTAWAY',
          toLocationId: createdLocation.id,
          note: 'Initial placement',
        },
        context,
      );

      expect(putaway?.currentPosition).toMatchObject({
        location: {
          id: createdLocation.id,
          code: 'A-01',
          type: 'SHELF',
        },
      });
      expect(
        await prisma.packageInventoryPosition.count({
          where: {
            organizationId: organization.id,
            packageId: receivedPackage.id,
          },
        }),
      ).toBe(1);
      expect(
        await prisma.inventoryMovement.count({
          where: {
            organizationId: organization.id,
            packageId: receivedPackage.id,
          },
        }),
      ).toBe(1);

      await expect(
        repository.movePackage(
          {
            organizationId: organization.id,
            packageId: receivedPackage.id,
            movedByEmployeeId: employee.id,
            movementType: 'PUTAWAY',
            toLocationId: createdLocation.id,
            note: 'Initial placement',
          },
          context,
        ),
      ).resolves.toMatchObject({
        id: receivedPackage.id,
        currentPosition: {
          location: {
            id: createdLocation.id,
          },
        },
      });
      expect(
        await prisma.inventoryMovement.count({
          where: {
            organizationId: organization.id,
            packageId: receivedPackage.id,
          },
        }),
      ).toBe(1);

      const hold = await repository.movePackage(
        {
          organizationId: organization.id,
          packageId: receivedPackage.id,
          movedByEmployeeId: employee.id,
          movementType: 'HOLD',
          toLocationId: holdLocation.id,
          note: 'Hold for inspection',
        },
        context,
      );
      expect(hold?.currentPosition?.location.type).toBe('HOLD');

      const release = await repository.movePackage(
        {
          organizationId: organization.id,
          packageId: receivedPackage.id,
          movedByEmployeeId: employee.id,
          movementType: 'RELEASE',
          toLocationId: createdLocation.id,
          note: 'Released from hold',
        },
        context,
      );
      expect(release?.currentPosition?.location.id).toBe(createdLocation.id);

      const removed = await repository.movePackage(
        {
          organizationId: organization.id,
          packageId: receivedPackage.id,
          movedByEmployeeId: employee.id,
          movementType: 'REMOVE',
          toLocationId: null,
          note: 'Loaded to dispatch',
        },
        context,
      );
      expect(removed?.currentPosition).toBeNull();

      const movements = await repository.listPackageMovements(
        organization.id,
        receivedPackage.id,
      );
      expect(movements).toHaveLength(4);
      expect(movements[0]?.movementType).toBe('REMOVE');
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'INVENTORY_MOVEMENT',
            action: 'inventory.package.moved',
            entityId: movements[0]?.id,
          },
        }),
      ).toBe(1);

      await expect(
        prisma.inventoryMovement.delete({
          where: { id: movements[0].id },
        }),
      ).rejects.toBeDefined();

      await expect(
        repository.movePackage(
          {
            organizationId: organization.id,
            packageId: pendingPackage.id,
            movedByEmployeeId: employee.id,
            movementType: 'PUTAWAY',
            toLocationId: createdLocation.id,
            note: null,
          },
          context,
        ),
      ).rejects.toBeInstanceOf(InventoryMovementConflictError);

      await expect(
        repository.movePackage(
          {
            organizationId: organization.id,
            packageId: receivedPackage.id,
            movedByEmployeeId: employee.id,
            movementType: 'PUTAWAY',
            toLocationId: crossFacilityLocation.id,
            note: null,
          },
          context,
        ),
      ).rejects.toBeInstanceOf(InventoryMovementConflictError);

      await expect(
        repository.movePackage(
          {
            organizationId: organization.id,
            packageId: foreignPackage.id,
            movedByEmployeeId: employee.id,
            movementType: 'PUTAWAY',
            toLocationId: createdLocation.id,
            note: null,
          },
          context,
        ),
      ).resolves.toBeNull();

      const auditCountBeforeFailure = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'INVENTORY_MOVEMENT',
        },
      });
      const failingWriter = jest
        .spyOn(PrismaAuditOutboxWriter.prototype, 'write')
        .mockRejectedValueOnce(new Error('forced inventory audit failure'));

      await expect(
        repository.movePackage(
          {
            organizationId: organization.id,
            packageId: rollbackPackage.id,
            movedByEmployeeId: employee.id,
            movementType: 'PUTAWAY',
            toLocationId: createdLocation.id,
            note: 'Should rollback',
          },
          {
            ...context,
            requestId: randomUUID(),
            correlationId: randomUUID(),
          },
        ),
      ).rejects.toThrow('forced inventory audit failure');

      failingWriter.mockRestore();

      expect(
        await prisma.packageInventoryPosition.count({
          where: {
            organizationId: organization.id,
            packageId: rollbackPackage.id,
          },
        }),
      ).toBe(0);
      expect(
        await prisma.inventoryMovement.count({
          where: {
            organizationId: organization.id,
            packageId: rollbackPackage.id,
          },
        }),
      ).toBe(0);
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'INVENTORY_MOVEMENT',
          },
        }),
      ).toBe(auditCountBeforeFailure);
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

function buildContext(
  organizationId: string,
  employeeId: string,
  userId: string,
): CommandContext {
  return {
    organizationId,
    actorType: 'EMPLOYEE',
    actorUserId: userId,
    actorEmployeeId: employeeId,
    source: 'HTTP',
    requestId: randomUUID(),
    correlationId: randomUUID(),
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
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
