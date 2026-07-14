import {
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PickupRequestsService } from '../src/pickups/pickups.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Pickup requests integration', () => {
  it('enforces concurrency, tenant isolation, financial eligibility and atomic events', async () => {
    process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prisma: PrismaService | null = null;
    const organizationIds: string[] = [];
    const userIds: string[] = [];
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
      const db = moduleRef.get(PrismaService);
      prisma = db;
      const service = moduleRef.get(PickupRequestsService);
      const first = await seedTenant(db, 'first');
      const second = await seedTenant(db, 'second');
      organizationIds.push(first.organizationId, second.organizationId);
      userIds.push(first.userId, second.userId);

      const dto = {
        customerId: first.customerId,
        facilityId: first.facilityId,
        packageIds: [first.packageId],
      };
      const attempts = await Promise.allSettled([
        service.create(first.context, dto),
        service.create(first.context, dto),
      ]);
      if (!attempts.some((item) => item.status === 'fulfilled')) {
        throw new Error(
          attempts
            .map((item) =>
              item.status === 'rejected' ? String(item.reason) : 'fulfilled',
            )
            .join(' | '),
        );
      }
      expect(
        attempts.filter((item) => item.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.filter((item) => item.status === 'rejected'),
      ).toHaveLength(1);
      const pickup = (
        attempts.find(
          (item) => item.status === 'fulfilled',
        ) as PromiseFulfilledResult<{ id: string }>
      ).value;
      await expect(
        service.findOne(second.context, pickup.id),
      ).rejects.toBeInstanceOf(NotFoundException);

      const invoice = await db.customerInvoice.create({
        data: {
          organizationId: first.organizationId,
          customerId: first.customerId,
          invoiceNumber: `INV-${randomUUID()}`,
          status: 'ISSUED',
          currencyCode: 'DOP',
          subtotalMinor: 100n,
          totalMinor: 100n,
          balanceDueMinor: 100n,
        },
      });
      await expect(
        service.markAsReady(first.context, pickup.id),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        (
          await db.pickupRequest.findUniqueOrThrow({
            where: {
              organizationId_id: {
                organizationId: first.organizationId,
                id: pickup.id,
              },
            },
          })
        ).status,
      ).toBe('DRAFT');
      expect(
        await db.outboxEvent.count({
          where: {
            organizationId: first.organizationId,
            aggregateId: pickup.id,
          },
        }),
      ).toBe(0);

      await db.customerInvoice.update({
        where: {
          organizationId_id: {
            organizationId: first.organizationId,
            id: invoice.id,
          },
        },
        data: { status: 'PAID', balanceDueMinor: 0n },
      });
      await service.markAsReady(first.context, pickup.id);
      await service.markAsReady(first.context, pickup.id);
      await service.complete(first.context, pickup.id);
      const completed = await service.complete(first.context, pickup.id);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedByEmployeeId).toBe(first.employeeId);
      expect(
        await db.outboxEvent.count({
          where: {
            organizationId: first.organizationId,
            aggregateId: pickup.id,
          },
        }),
      ).toBe(2);
      expect(
        await db.auditLog.count({
          where: {
            organizationId: first.organizationId,
            entityId: pickup.id,
            action: {
              in: ['pickup_request.ready', 'pickup_request.completed'],
            },
          },
        }),
      ).toBe(2);
    } finally {
      if (prisma) {
        await prisma.paymentAllocation.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.invoiceLine.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.customerInvoice.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await deleteAuditArtifactsForOrganizations(prisma, organizationIds);
        await prisma.pickupRequestItem.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.pickupRequest.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.package.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.facility.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.customer.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.employee.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.organizationSettings.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      await app?.close();
      await moduleRef?.close();
    }
  }, 120_000);
});

async function seedTenant(prisma: PrismaService, label: string) {
  const suffix = randomUUID();
  const compact = suffix.replaceAll('-', '').toUpperCase();
  const organization = await prisma.organization.create({
    data: {
      legalName: `Pickup ${label} ${suffix}`,
      commercialName: `Pickup ${label}`,
      slug: `pickup-${label}-${suffix}`,
      status: 'ACTIVE',
    },
  });
  await prisma.organizationSettings.create({
    data: { organizationId: organization.id },
  });
  const user = await prisma.user.create({
    data: { email: `pickup.${label}.${suffix}@courier.test`, status: 'ACTIVE' },
  });
  const employee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      firstName: 'Pickup',
      lastName: label,
      status: 'ACTIVE',
    },
  });
  const customer = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      customerCode: `PU${compact.slice(0, 8)}`,
      type: 'INDIVIDUAL',
      firstName: 'Pickup',
      lastName: 'Customer',
      status: 'ACTIVE',
    },
  });
  const facility = await prisma.facility.create({
    data: {
      organizationId: organization.id,
      code: `BR${compact.slice(0, 6)}`,
      name: 'Pickup branch',
      type: 'BRANCH',
      isActive: true,
      isCustomerFacing: true,
    },
  });
  const pkg = await prisma.package.create({
    data: {
      organizationId: organization.id,
      customerId: customer.id,
      registeredByEmployeeId: employee.id,
      internalTrackingNumber: 'PKABCDEFGH2345',
      externalTrackingNumber: suffix,
      externalTrackingNumberNormalized: compact,
      status: 'ARRIVED_AT_DESTINATION',
    },
  });
  return {
    organizationId: organization.id,
    userId: user.id,
    employeeId: employee.id,
    customerId: customer.id,
    facilityId: facility.id,
    packageId: pkg.id,
    context: buildContext(organization.id, employee.id, user.id),
  };
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
