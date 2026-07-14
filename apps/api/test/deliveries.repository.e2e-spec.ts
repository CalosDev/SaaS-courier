import {
  INestApplication,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { DeliveriesService } from '../src/deliveries/deliveries.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Deliveries integration', () => {
  it('enforces tenant-safe final delivery, failures, masking and cancellation', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
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
      const deliveries = moduleRef.get(DeliveriesService);
      const suffix = randomUUID();

      const [organization, otherOrganization] = await Promise.all([
        prisma.organization.create({
          data: {
            legalName: `Deliveries Org ${suffix}`,
            commercialName: `Deliveries Org ${suffix}`,
            slug: `deliveries-${suffix}`,
            status: 'ACTIVE',
          },
        }),
        prisma.organization.create({
          data: {
            legalName: `Deliveries Other ${suffix}`,
            commercialName: `Deliveries Other ${suffix}`,
            slug: `deliveries-other-${suffix}`,
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
          data: {
            email: `deliveries.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
        }),
        prisma.user.create({
          data: {
            email: `deliveries.other.${suffix}@courier.test`,
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
            firstName: 'Delivery',
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

      const [customer, otherCustomer] = await Promise.all([
        createCustomer(
          prisma,
          organization.id,
          `DELC${suffix.slice(0, 6).toUpperCase()}`,
        ),
        createCustomer(
          prisma,
          otherOrganization.id,
          `DELO${suffix.slice(0, 6).toUpperCase()}`,
        ),
      ]);
      cleanup.customerIds.push(customer.id, otherCustomer.id);

      const [packageRecord, cancellationPackage] = await Promise.all([
        createPackage(
          prisma,
          organization.id,
          customer.id,
          employee.id,
          suffix,
          1,
        ),
        createPackage(
          prisma,
          organization.id,
          customer.id,
          employee.id,
          suffix,
          2,
        ),
      ]);
      cleanup.packageIds.push(packageRecord.id, cancellationPackage.id);

      const context = () => buildContext(organization.id, employee.id, user.id);
      const otherContext = () =>
        buildContext(otherOrganization.id, otherEmployee.id, otherUser.id);
      const address = {
        line1: 'Calle Principal 1',
        city: 'Santo Domingo',
        countryCode: 'DO',
      };

      const failedDelivery = await deliveries.create(context(), {
        deliveryNumber: `DEL-${suffix.slice(0, 8)}-1`,
        customerId: customer.id,
        method: 'HOME_DELIVERY',
        deliveryAddressSnap: address,
        assignedToId: employee.id,
        packageIds: [packageRecord.id],
      });
      await expect(
        deliveries.findOne(otherContext(), failedDelivery.id),
      ).rejects.toThrow(NotFoundException);
      await expect(
        deliveries.create(context(), {
          deliveryNumber: `DEL-${suffix.slice(0, 8)}-DUP`,
          customerId: customer.id,
          method: 'HOME_DELIVERY',
          deliveryAddressSnap: address,
          packageIds: [packageRecord.id],
        }),
      ).rejects.toThrow(ConflictException);

      await deliveries.markReady(context(), failedDelivery.id);
      await deliveries.dispatch(context(), failedDelivery.id);
      expect(
        await prisma.package.findUniqueOrThrow({
          where: { id: packageRecord.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'OUT_FOR_DELIVERY' });

      for (const result of ['NOT_HOME', 'ADDRESS_ISSUE', 'OTHER'] as const) {
        await deliveries.recordAttempt(context(), failedDelivery.id, {
          result,
          notes: `Attempt ${result}`,
        });
      }
      expect(
        await prisma.deliveryOrder.findUniqueOrThrow({
          where: { id: failedDelivery.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'FAILED' });
      expect(
        await prisma.package.findUniqueOrThrow({
          where: { id: packageRecord.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'ARRIVED_AT_DESTINATION' });

      const successful = await deliveries.create(context(), {
        deliveryNumber: `DEL-${suffix.slice(0, 8)}-2`,
        customerId: customer.id,
        method: 'HOME_DELIVERY',
        deliveryAddressSnap: address,
        packageIds: [packageRecord.id],
      });
      await deliveries.markReady(context(), successful.id);
      await deliveries.dispatch(context(), successful.id);
      await deliveries.recordAttempt(context(), successful.id, {
        result: 'DELIVERED',
        receiverName: 'Juan Perez',
      });
      const successfulResult = await deliveries.findOne(
        context(),
        successful.id,
      );
      expect(successfulResult.status).toBe('DELIVERED');
      expect(successfulResult.attempts[0]?.receiverName).toBe('J*** P****');
      expect(
        await prisma.package.findUniqueOrThrow({
          where: { id: packageRecord.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'DELIVERED' });

      const cancellable = await deliveries.create(context(), {
        deliveryNumber: `DEL-${suffix.slice(0, 8)}-3`,
        customerId: customer.id,
        method: 'COUNTER_HANDOFF',
        packageIds: [cancellationPackage.id],
      });
      const cancelled = await deliveries.cancel(context(), cancellable.id);
      expect(cancelled.status).toBe('CANCELLED');
    } finally {
      if (prismaService) {
        await prismaService.deliveryAttempt.deleteMany({
          where: { organizationId: { in: cleanup.organizationIds } },
        });
        await prismaService.deliveryOrderItem.deleteMany({
          where: { organizationId: { in: cleanup.organizationIds } },
        });
        await prismaService.deliveryOrder.deleteMany({
          where: { organizationId: { in: cleanup.organizationIds } },
        });
        await deleteAuditArtifactsForOrganizations(
          prismaService,
          cleanup.organizationIds,
        );
        await prismaService.package.deleteMany({
          where: { id: { in: cleanup.packageIds } },
        });
        await prismaService.customer.deleteMany({
          where: { id: { in: cleanup.customerIds } },
        });
        await prismaService.employee.deleteMany({
          where: { id: { in: cleanup.employeeIds } },
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
      firstName: 'Delivery',
      lastName: 'Customer',
      status: 'ACTIVE',
    },
  });
}

function createPackage(
  prisma: PrismaService,
  organizationId: string,
  customerId: string,
  employeeId: string,
  suffix: string,
  index: number,
) {
  const tracking = `DEL${suffix.replace(/-/g, '').toUpperCase()}${index}`;
  return prisma.package.create({
    data: {
      organizationId,
      customerId,
      registeredByEmployeeId: employeeId,
      internalTrackingNumber: buildPackageCode(),
      externalTrackingNumber: tracking,
      externalTrackingNumberNormalized: tracking,
      status: 'ARRIVED_AT_DESTINATION',
    },
  });
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
