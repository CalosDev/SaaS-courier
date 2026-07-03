import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { PrismaAuditOutboxWriter } from '../src/audit/prisma-audit-outbox.writer';
import { PrealertTrackingConflictError } from '../src/prealerts/prealert.errors';
import { PrealertsRepository } from '../src/prealerts/prealerts.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Prealerts repository integration', () => {
  it('enforces tenant-safe tracking uniqueness, allows reuse after cancellation, and rolls back when audit/outbox writing fails', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      customerIds: [] as string[],
      prealertIds: [] as string[],
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
      const repository =
        moduleRef.get<PrealertsRepository>(PrealertsRepository);
      const suffix = randomUUID();

      const organization = await prisma.organization.create({
        data: {
          legalName: `Prealerts Org ${suffix}`,
          commercialName: `Prealerts Org ${suffix}`,
          slug: `prealerts-org-${suffix}`,
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
          slug: `prealerts-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(otherOrganization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: otherOrganization.id },
      });

      const [userOne, userTwo] = await prisma.$transaction([
        prisma.user.create({
          data: {
            email: `prealerts.one.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
        }),
        prisma.user.create({
          data: {
            email: `prealerts.two.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.userIds.push(userOne.id, userTwo.id);

      const employeeOne = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: userOne.id,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      const employeeTwo = await prisma.employee.create({
        data: {
          organizationId: otherOrganization.id,
          userId: userTwo.id,
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeOne.id, employeeTwo.id);

      const customerOne = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: 'CUST-ONE',
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      const customerTwo = await prisma.customer.create({
        data: {
          organizationId: otherOrganization.id,
          customerCode: 'CUST-TWO',
          type: 'INDIVIDUAL',
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.customerIds.push(customerOne.id, customerTwo.id);

      const trackingOriginal = '1Z-999-AA1-01-2345-6784';
      const trackingNormalized = '1Z999AA10123456784';
      const firstContext = buildContext(
        organization.id,
        employeeOne.id,
        userOne.id,
      );
      const secondContext = buildContext(
        otherOrganization.id,
        employeeTwo.id,
        userTwo.id,
      );

      const created = await repository.create(
        {
          organizationId: organization.id,
          customerId: customerOne.id,
          createdByEmployeeId: employeeOne.id,
          externalTrackingNumber: trackingOriginal,
          externalTrackingNumberNormalized: trackingNormalized,
          carrierName: 'UPS',
          storeName: 'Amazon',
          purchaseDate: new Date('2026-07-03T00:00:00.000Z'),
          description: 'Headphones',
          quantity: 1,
          declaredValue: '49.99',
          currencyCode: 'USD',
          invoiceStatus: 'PENDING',
          status: 'PENDING_ARRIVAL',
          notes: 'Handle with care',
        },
        firstContext,
      );
      cleanup.prealertIds.push(created.id);

      expect(created.prealertCode).toMatch(/^PA[A-HJ-NP-Z2-9]{10}$/);
      expect(created.status).toBe('PENDING_ARRIVAL');

      await expect(
        repository.create(
          {
            organizationId: organization.id,
            customerId: customerOne.id,
            createdByEmployeeId: employeeOne.id,
            externalTrackingNumber: trackingOriginal,
            externalTrackingNumberNormalized: trackingNormalized,
            carrierName: 'UPS',
            storeName: 'Amazon',
            purchaseDate: null,
            description: 'Duplicate',
            quantity: 1,
            declaredValue: '10.00',
            currencyCode: 'USD',
            invoiceStatus: 'PENDING',
            status: 'PENDING_ARRIVAL',
            notes: null,
          },
          firstContext,
        ),
      ).rejects.toBeInstanceOf(PrealertTrackingConflictError);

      const allowedOtherTenant = await repository.create(
        {
          organizationId: otherOrganization.id,
          customerId: customerTwo.id,
          createdByEmployeeId: employeeTwo.id,
          externalTrackingNumber: trackingOriginal,
          externalTrackingNumberNormalized: trackingNormalized,
          carrierName: 'UPS',
          storeName: 'Amazon',
          purchaseDate: null,
          description: 'Other tenant',
          quantity: 1,
          declaredValue: '10.00',
          currencyCode: 'USD',
          invoiceStatus: 'PENDING',
          status: 'PENDING_ARRIVAL',
          notes: null,
        },
        secondContext,
      );
      cleanup.prealertIds.push(allowedOtherTenant.id);

      const cancelled = await repository.cancel(
        organization.id,
        created.id,
        'Customer cancelled the purchase',
        firstContext,
      );
      expect(cancelled?.status).toBe('CANCELLED');

      const recreated = await repository.create(
        {
          organizationId: organization.id,
          customerId: customerOne.id,
          createdByEmployeeId: employeeOne.id,
          externalTrackingNumber: trackingOriginal,
          externalTrackingNumberNormalized: trackingNormalized,
          carrierName: 'UPS',
          storeName: 'Amazon',
          purchaseDate: null,
          description: 'Recreated after cancellation',
          quantity: 1,
          declaredValue: '10.00',
          currencyCode: 'USD',
          invoiceStatus: 'PENDING',
          status: 'PENDING_ARRIVAL',
          notes: null,
        },
        firstContext,
      );
      cleanup.prealertIds.push(recreated.id);

      const latestAuditLog = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          entityId: recreated.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      const latestOutboxEvent = await prisma.outboxEvent.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          aggregateId: recreated.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(latestAuditLog.action).toBe('prealert.created');
      expect(latestAuditLog.entityType).toBe('PREALERT');
      expect(latestOutboxEvent.eventType).toBe('prealert.created');
      expect(latestOutboxEvent.status).toBe('PENDING');
      expect(JSON.stringify(latestAuditLog.afterData)).toContain('********');
      expect(JSON.stringify(latestOutboxEvent.payload)).toContain('********');

      const failingAuditSpy = jest
        .spyOn(PrismaAuditOutboxWriter.prototype, 'write')
        .mockRejectedValueOnce(new Error('forced audit failure'));

      await expect(
        repository.create(
          {
            organizationId: organization.id,
            customerId: customerOne.id,
            createdByEmployeeId: employeeOne.id,
            externalTrackingNumber: 'LX123456789US',
            externalTrackingNumberNormalized: 'LX123456789US',
            carrierName: 'USPS',
            storeName: 'eBay',
            purchaseDate: null,
            description: 'Audit rollback',
            quantity: 1,
            declaredValue: '10.00',
            currencyCode: 'USD',
            invoiceStatus: 'PENDING',
            status: 'PENDING_ARRIVAL',
            notes: null,
          },
          firstContext,
        ),
      ).rejects.toThrow('forced audit failure');

      failingAuditSpy.mockRestore();

      expect(
        await prisma.prealert.count({
          where: {
            organizationId: organization.id,
            externalTrackingNumberNormalized: 'LX123456789US',
          },
        }),
      ).toBe(0);

      const auditCountBeforeOutboxFailure = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'PREALERT',
        },
      });

      const failingOutboxSpy = jest
        .spyOn(PrismaAuditOutboxWriter.prototype, 'write')
        .mockImplementationOnce(async (tx, input) => {
          await tx.auditLog.create({
            data: {
              id: randomUUID(),
              organizationId: input.context.organizationId,
              actorType: input.context.actorType,
              actorUserId: input.context.actorUserId,
              actorEmployeeId: input.context.actorEmployeeId,
              action: input.action,
              entityType: input.entityType,
              entityId: input.entityId,
              source: input.context.source,
              requestId: input.context.requestId,
              correlationId: input.context.correlationId,
              changedFields: [],
              occurredAt: new Date(),
            },
          });
          throw new Error('forced outbox failure');
        });

      await expect(
        repository.create(
          {
            organizationId: organization.id,
            customerId: customerOne.id,
            createdByEmployeeId: employeeOne.id,
            externalTrackingNumber: '9400111111111111111111',
            externalTrackingNumberNormalized: '9400111111111111111111',
            carrierName: 'USPS',
            storeName: 'Target',
            purchaseDate: null,
            description: 'Outbox rollback',
            quantity: 1,
            declaredValue: '10.00',
            currencyCode: 'USD',
            invoiceStatus: 'PENDING',
            status: 'PENDING_ARRIVAL',
            notes: null,
          },
          firstContext,
        ),
      ).rejects.toThrow('forced outbox failure');

      failingOutboxSpy.mockRestore();

      expect(
        await prisma.prealert.count({
          where: {
            organizationId: organization.id,
            externalTrackingNumberNormalized: '9400111111111111111111',
          },
        }),
      ).toBe(0);
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'PREALERT',
          },
        }),
      ).toBe(auditCountBeforeOutboxFailure);
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
