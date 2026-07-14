import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { TransfersService } from '../src/transfers/transfers.service';
import {
  deleteAuditArtifactsForOrganizations,
  deleteInventoryArtifactsForOrganizations,
} from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Transfers integration', () => {
  it('moves inventory tenant-safely and records received and missing items', async () => {
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
      const transfers = moduleRef.get(TransfersService);
      const suffix = randomUUID();

      const [organization, otherOrganization] = await Promise.all([
        prisma.organization.create({
          data: {
            legalName: `Transfers Org ${suffix}`,
            commercialName: `Transfers Org ${suffix}`,
            slug: `transfers-${suffix}`,
            status: 'ACTIVE',
          },
        }),
        prisma.organization.create({
          data: {
            legalName: `Transfers Other ${suffix}`,
            commercialName: `Transfers Other ${suffix}`,
            slug: `transfers-other-${suffix}`,
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.organizationIds.push(organization.id, otherOrganization.id);
      await prisma.organizationSettings.createMany({
        data: [
          { organizationId: organization.id },
          { organizationId: otherOrganization.id },
        ],
      });

      const [user, otherUser] = await Promise.all([
        prisma.user.create({
          data: { email: `transfers.${suffix}@courier.test`, status: 'ACTIVE' },
        }),
        prisma.user.create({
          data: {
            email: `transfers.other.${suffix}@courier.test`,
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
            firstName: 'Transfer',
            lastName: 'Operator',
            status: 'ACTIVE',
          },
        }),
        prisma.employee.create({
          data: {
            organizationId: otherOrganization.id,
            userId: otherUser.id,
            firstName: 'Other',
            lastName: 'Operator',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.employeeIds.push(employee.id, otherEmployee.id);

      const [origin, destination, otherFacility] = await Promise.all([
        createFacility(prisma, organization.id, 'TRF-ORIGIN', true),
        createFacility(prisma, organization.id, 'TRF-DEST', false),
        createFacility(prisma, otherOrganization.id, 'TRF-OTHER', true),
      ]);
      cleanup.facilityIds.push(origin.id, destination.id, otherFacility.id);

      const [customer, otherCustomer] = await Promise.all([
        createCustomer(
          prisma,
          organization.id,
          `TRFC${suffix.slice(0, 6).toUpperCase()}`,
        ),
        createCustomer(
          prisma,
          otherOrganization.id,
          `TRFO${suffix.slice(0, 6).toUpperCase()}`,
        ),
      ]);
      cleanup.customerIds.push(customer.id, otherCustomer.id);

      const [receivedPackage, missingPackage] = await Promise.all([
        createReceivedPackage(
          prisma,
          organization.id,
          customer.id,
          employee.id,
          origin.id,
          `TRF-${suffix}-1`,
        ),
        createReceivedPackage(
          prisma,
          organization.id,
          customer.id,
          employee.id,
          origin.id,
          `TRF-${suffix}-2`,
        ),
      ]);
      cleanup.packageIds.push(receivedPackage.id, missingPackage.id);

      const [originLocation, destinationLocation] = await Promise.all([
        prisma.warehouseLocation.create({
          data: {
            organizationId: organization.id,
            facilityId: origin.id,
            code: 'TRF-OR-01',
            name: 'Transfer origin shelf',
            type: 'SHELF',
            isActive: true,
          },
        }),
        prisma.warehouseLocation.create({
          data: {
            organizationId: organization.id,
            facilityId: destination.id,
            code: 'TRF-DST-01',
            name: 'Transfer destination receiving',
            type: 'RECEIVING',
            isActive: true,
          },
        }),
      ]);
      await prisma.packageInventoryPosition.createMany({
        data: [receivedPackage.id, missingPackage.id].map((packageId) => ({
          organizationId: organization.id,
          packageId,
          facilityId: origin.id,
          locationId: originLocation.id,
        })),
      });

      const context = () => buildContext(organization.id, employee.id, user.id);
      const otherContext = () =>
        buildContext(otherOrganization.id, otherEmployee.id, otherUser.id);
      const foreignTransfer = await transfers
        .createTransfer(otherContext(), {
          originFacilityId: otherFacility.id,
          destinationFacilityId: otherFacility.id,
        })
        .catch(() => null);
      expect(foreignTransfer).toBeNull();

      const transfer = await transfers.createTransfer(context(), {
        originFacilityId: origin.id,
        destinationFacilityId: destination.id,
        notes: 'Integration transfer',
      });
      await expect(
        transfers.getTransferById(otherContext(), transfer.id),
      ).rejects.toThrow(NotFoundException);

      const firstItem = await transfers.addItem(context(), transfer.id, {
        packageId: receivedPackage.id,
      });
      const secondItem = await transfers.addItem(context(), transfer.id, {
        packageId: missingPackage.id,
      });

      const dispatched = await transfers.dispatchTransfer(
        context(),
        transfer.id,
      );
      expect(dispatched.status).toBe('IN_TRANSIT');
      expect(
        await prisma.packageInventoryPosition.count({
          where: { packageId: { in: cleanup.packageIds } },
        }),
      ).toBe(0);
      expect(
        await prisma.package.count({
          where: {
            id: { in: cleanup.packageIds },
            status: 'IN_TRANSIT',
          },
        }),
      ).toBe(2);

      await transfers.receiveItem(context(), transfer.id, firstItem.id, {
        status: 'RECEIVED',
        destinationLocationId: destinationLocation.id,
      });
      await transfers.receiveItem(context(), transfer.id, secondItem.id, {
        status: 'MISSING',
        notes: 'Not present at destination',
      });

      const completed = await transfers.getTransferById(context(), transfer.id);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: firstItem.id, status: 'RECEIVED' }),
          expect.objectContaining({ id: secondItem.id, status: 'MISSING' }),
        ]),
      );
      expect(
        await prisma.packageInventoryPosition.findUnique({
          where: {
            organizationId_packageId: {
              organizationId: organization.id,
              packageId: receivedPackage.id,
            },
          },
        }),
      ).toMatchObject({
        facilityId: destination.id,
        locationId: destinationLocation.id,
      });
      expect(
        await prisma.packageInventoryPosition.findUnique({
          where: {
            organizationId_packageId: {
              organizationId: organization.id,
              packageId: missingPackage.id,
            },
          },
        }),
      ).toBeNull();
      expect(
        await prisma.inventoryMovement.count({
          where: { organizationId: organization.id },
        }),
      ).toBe(3);

      const cancellable = await transfers.createTransfer(context(), {
        originFacilityId: origin.id,
        destinationFacilityId: destination.id,
      });
      const cancelled = await transfers.cancelTransfer(
        context(),
        cancellable.id,
      );
      expect(cancelled.status).toBe('CANCELLED');
      expect(
        await prisma.facilityTransferEvent.count({
          where: {
            organizationId: organization.id,
            transferId: cancellable.id,
            eventType: 'CANCELLED',
          },
        }),
      ).toBe(1);
    } finally {
      if (prismaService) {
        await prismaService.facilityTransferEvent.deleteMany({
          where: { organizationId: { in: cleanup.organizationIds } },
        });
        await prismaService.facilityTransferItem.deleteMany({
          where: { organizationId: { in: cleanup.organizationIds } },
        });
        await prismaService.facilityTransfer.deleteMany({
          where: { organizationId: { in: cleanup.organizationIds } },
        });
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
      await app?.close();
      await moduleRef?.close();
    }
  }, 120_000);
});

function createFacility(
  prisma: PrismaService,
  organizationId: string,
  code: string,
  isPackageOrigin: boolean,
) {
  return prisma.facility.create({
    data: {
      organizationId,
      code,
      name: code,
      type: isPackageOrigin ? 'INTERNATIONAL_WAREHOUSE' : 'DISTRIBUTION_CENTER',
      isPackageOrigin,
      isActive: true,
    },
  });
}

function createCustomer(
  prisma: PrismaService,
  organizationId: string,
  customerCode: string,
) {
  return prisma.customer.create({
    data: {
      organizationId,
      customerCode,
      type: 'INDIVIDUAL',
      firstName: 'Transfer',
      lastName: 'Customer',
      status: 'ACTIVE',
    },
  });
}

async function createReceivedPackage(
  prisma: PrismaService,
  organizationId: string,
  customerId: string,
  employeeId: string,
  facilityId: string,
  tracking: string,
) {
  const packageRecord = await prisma.package.create({
    data: {
      organizationId,
      customerId,
      registeredByEmployeeId: employeeId,
      internalTrackingNumber: buildPackageCode(),
      externalTrackingNumber: tracking,
      externalTrackingNumberNormalized: tracking
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase(),
      status: 'RECEIVED_AT_ORIGIN',
    },
  });
  await prisma.packageReception.create({
    data: {
      organizationId,
      packageId: packageRecord.id,
      facilityId,
      receivedByEmployeeId: employeeId,
      weight: '1.000',
      weightUnit: 'LB',
      length: '1.00',
      width: '1.00',
      height: '1.00',
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
