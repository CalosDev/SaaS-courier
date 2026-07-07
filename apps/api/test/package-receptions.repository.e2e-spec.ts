import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import {
  PackageReceptionConflictError,
  PackageReceptionFacilityUnavailableError,
} from '../src/packages/package-reception.errors';
import { PackageReceptionsRepository } from '../src/packages/package-receptions.repository';
import { PackageNotFoundError } from '../src/packages/package.errors';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Package receptions repository integration', () => {
  it('receives once, isolates tenants, validates facility access, and rolls back audit/outbox failures', async () => {
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
      const repository = moduleRef.get<PackageReceptionsRepository>(
        PackageReceptionsRepository,
      );
      const suffix = randomUUID();

      const organization = await prisma.organization.create({
        data: {
          legalName: `Reception Org ${suffix}`,
          commercialName: `Reception Org ${suffix}`,
          slug: `reception-org-${suffix}`,
          status: 'ACTIVE',
        },
      });
      const otherOrganization = await prisma.organization.create({
        data: {
          legalName: `Reception Other ${suffix}`,
          commercialName: `Reception Other ${suffix}`,
          slug: `reception-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id, otherOrganization.id);

      await prisma.organizationSettings.createMany({
        data: [
          {
            organizationId: organization.id,
            weightUnit: 'KG',
            dimensionUnit: 'CM',
          },
          { organizationId: otherOrganization.id },
        ],
      });

      const [facility, unavailableFacility, foreignFacility] =
        await Promise.all([
          prisma.facility.create({
            data: {
              organizationId: organization.id,
              code: 'MIA-01',
              name: 'Miami Origin',
              type: 'INTERNATIONAL_WAREHOUSE',
              isPackageOrigin: true,
              isActive: true,
            },
          }),
          prisma.facility.create({
            data: {
              organizationId: organization.id,
              code: 'SDQ-01',
              name: 'Santo Domingo',
              type: 'DISTRIBUTION_CENTER',
              isPackageOrigin: false,
              isActive: true,
            },
          }),
          prisma.facility.create({
            data: {
              organizationId: otherOrganization.id,
              code: 'OTHER-01',
              name: 'Other Origin',
              type: 'INTERNATIONAL_WAREHOUSE',
              isPackageOrigin: true,
              isActive: true,
            },
          }),
        ]);
      cleanup.facilityIds.push(
        facility.id,
        unavailableFacility.id,
        foreignFacility.id,
      );

      const [user, foreignUser] = await Promise.all([
        prisma.user.create({
          data: {
            email: `reception.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
        }),
        prisma.user.create({
          data: {
            email: `reception.other.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
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

      await prisma.employeeFacility.create({
        data: {
          organizationId: organization.id,
          employeeId: employee.id,
          facilityId: facility.id,
          isPrimary: true,
        },
      });
      await prisma.employeeFacility.create({
        data: {
          organizationId: otherOrganization.id,
          employeeId: foreignEmployee.id,
          facilityId: foreignFacility.id,
          isPrimary: true,
        },
      });

      const [customer, foreignCustomer] = await Promise.all([
        prisma.customer.create({
          data: {
            organizationId: organization.id,
            customerCode: 'REC-ONE',
            type: 'INDIVIDUAL',
            firstName: 'Local',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
        prisma.customer.create({
          data: {
            organizationId: otherOrganization.id,
            customerCode: 'REC-TWO',
            type: 'INDIVIDUAL',
            firstName: 'Foreign',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.customerIds.push(customer.id, foreignCustomer.id);

      const packageRecord = await prisma.package.create({
        data: {
          organizationId: organization.id,
          customerId: customer.id,
          registeredByEmployeeId: employee.id,
          internalTrackingNumber: buildCode(),
          externalTrackingNumber: `EXT-${suffix}`,
          externalTrackingNumberNormalized:
            `EXT${suffix.replaceAll('-', '')}`.toUpperCase(),
        },
      });
      const rollbackPackage = await prisma.package.create({
        data: {
          organizationId: organization.id,
          customerId: customer.id,
          registeredByEmployeeId: employee.id,
          internalTrackingNumber: buildCode(),
          externalTrackingNumber: `ROLLBACK-${suffix}`,
          externalTrackingNumberNormalized:
            `ROLLBACK${suffix.replaceAll('-', '')}`.toUpperCase(),
        },
      });
      const foreignPackage = await prisma.package.create({
        data: {
          organizationId: otherOrganization.id,
          customerId: foreignCustomer.id,
          registeredByEmployeeId: foreignEmployee.id,
          internalTrackingNumber: buildCode(),
          externalTrackingNumber: `FOREIGN-${suffix}`,
          externalTrackingNumberNormalized:
            `FOREIGN${suffix.replaceAll('-', '')}`.toUpperCase(),
        },
      });
      cleanup.packageIds.push(
        packageRecord.id,
        rollbackPackage.id,
        foreignPackage.id,
      );

      const context = buildContext(organization.id, employee.id, user.id);
      const input = {
        organizationId: organization.id,
        packageId: packageRecord.id,
        facilityId: facility.id,
        receivedByEmployeeId: employee.id,
        weight: '12.500',
        length: '10.00',
        width: '8.00',
        height: '6.00',
        pieceCount: 1,
        condition: 'SEALED' as const,
      };

      const received = await repository.receive(input, context);

      expect(received).toMatchObject({
        packageId: packageRecord.id,
        weight: '12.500',
        weightUnit: 'KG',
        dimensionUnit: 'CM',
        condition: 'SEALED',
      });
      expect(
        await prisma.package.findUniqueOrThrow({
          where: { id: packageRecord.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'RECEIVED_AT_ORIGIN' });
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityId: packageRecord.id,
            action: 'package.received',
          },
        }),
      ).toBe(1);
      expect(
        await prisma.outboxEvent.count({
          where: {
            organizationId: organization.id,
            aggregateId: packageRecord.id,
            eventType: 'package.received',
          },
        }),
      ).toBe(1);

      await expect(repository.receive(input, context)).resolves.toEqual(
        received,
      );
      await expect(
        repository.receive({ ...input, weight: '13.000' }, context),
      ).rejects.toBeInstanceOf(PackageReceptionConflictError);

      await expect(
        repository.receive({ ...input, packageId: foreignPackage.id }, context),
      ).rejects.toBeInstanceOf(PackageNotFoundError);
      await expect(
        repository.receive(
          {
            ...input,
            packageId: rollbackPackage.id,
            facilityId: unavailableFacility.id,
          },
          context,
        ),
      ).rejects.toBeInstanceOf(PackageReceptionFacilityUnavailableError);

      const rollbackContext = {
        ...context,
        requestId: randomUUID(),
        correlationId: randomUUID(),
      };
      const idempotencyKey = `${rollbackContext.requestId}:package.received:PACKAGE:${rollbackPackage.id}`;
      await prisma.outboxEvent.create({
        data: {
          organizationId: organization.id,
          eventType: 'package.received',
          aggregateType: 'PACKAGE',
          aggregateId: rollbackPackage.id,
          schemaVersion: 1,
          payload: {},
          idempotencyKey,
          status: 'PENDING',
          occurredAt: new Date(),
          availableAt: new Date(),
        },
      });

      await expect(
        repository.receive(
          { ...input, packageId: rollbackPackage.id },
          rollbackContext,
        ),
      ).rejects.toBeDefined();
      expect(
        await prisma.package.findUniqueOrThrow({
          where: { id: rollbackPackage.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'RECEPTION_PENDING' });
      expect(
        await prisma.packageReception.count({
          where: { packageId: rollbackPackage.id },
        }),
      ).toBe(0);
    } finally {
      if (prismaService) {
        await prismaService.packageReception.deleteMany({
          where: { packageId: { in: cleanup.packageIds } },
        });
        await prismaService.package.deleteMany({
          where: { id: { in: cleanup.packageIds } },
        });
        await prismaService.customer.deleteMany({
          where: { id: { in: cleanup.customerIds } },
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
      if (app) await app.close();
      if (moduleRef) await moduleRef.close();
    }
  }, 120_000);
});

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
    ipAddress: null,
    userAgent: 'jest',
  };
}

function buildCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'PK';

  while (value.length < 14) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}
