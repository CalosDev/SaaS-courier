import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { PrismaAuditOutboxWriter } from '../src/audit/prisma-audit-outbox.writer';
import {
  PackagePrealertMatchRequiredError,
  PackagePrealertUnavailableError,
  PackageTrackingConflictError,
} from '../src/packages/package.errors';
import { PackagesRepository } from '../src/packages/packages.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
const TRACKING_ONE = '1Z-999-AA1-01-2345-6784';
const TRACKING_ONE_NORMALIZED = '1Z999AA10123456784';
const TRACKING_PREALERT = 'LX-123-456-789-US';
const TRACKING_PREALERT_NORMALIZED = 'LX123456789US';

describe('Packages repository integration', () => {
  it('enforces tenant-safe duplicates, matches prealerts atomically, and reopens linked prealerts on cancellation', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      customerIds: [] as string[],
      prealertIds: [] as string[],
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
      const repository = moduleRef.get<PackagesRepository>(PackagesRepository);
      const suffix = randomUUID();

      const organization = await prisma.organization.create({
        data: {
          legalName: `Packages Org ${suffix}`,
          commercialName: `Packages Org ${suffix}`,
          slug: `packages-org-${suffix}`,
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
          slug: `packages-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(otherOrganization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: otherOrganization.id },
      });

      const userOne = await prisma.user.create({
        data: {
          email: `packages.one.${suffix}@courier.test`,
          status: 'ACTIVE',
        },
      });
      const userTwo = await prisma.user.create({
        data: {
          email: `packages.two.${suffix}@courier.test`,
          status: 'ACTIVE',
        },
      });
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
          customerCode: 'PKG-ONE',
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      const customerTwo = await prisma.customer.create({
        data: {
          organizationId: otherOrganization.id,
          customerCode: 'PKG-TWO',
          type: 'INDIVIDUAL',
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.customerIds.push(customerOne.id, customerTwo.id);

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

      const createdManual = await repository.createManual(
        {
          organizationId: organization.id,
          customerId: customerOne.id,
          registeredByEmployeeId: employeeOne.id,
          externalTrackingNumber: TRACKING_ONE,
          externalTrackingNumberNormalized: TRACKING_ONE_NORMALIZED,
          notes: 'Handle with care',
        },
        firstContext,
      );
      cleanup.packageIds.push(createdManual.id);

      expect(createdManual.internalTrackingNumber).toMatch(
        /^PK[A-HJ-NP-Z2-9]{12}$/,
      );
      expect(createdManual.status).toBe('RECEPTION_PENDING');
      expect(createdManual.source).toBe('MANUAL');

      const latestManualAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          entityType: 'PACKAGE',
          entityId: createdManual.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      const latestManualOutbox = await prisma.outboxEvent.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          aggregateType: 'PACKAGE',
          aggregateId: createdManual.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(latestManualAudit.action).toBe('package.created');
      expect(latestManualOutbox.eventType).toBe('package.created');
      expect(latestManualOutbox.status).toBe('PENDING');
      expect(JSON.stringify(latestManualAudit.afterData)).toContain('********');
      expect(JSON.stringify(latestManualOutbox.payload)).toContain('********');

      await expect(
        repository.createManual(
          {
            organizationId: organization.id,
            customerId: customerOne.id,
            registeredByEmployeeId: employeeOne.id,
            externalTrackingNumber: TRACKING_ONE,
            externalTrackingNumberNormalized: TRACKING_ONE_NORMALIZED,
            notes: null,
          },
          firstContext,
        ),
      ).rejects.toBeInstanceOf(PackageTrackingConflictError);

      const crossTenantManual = await repository.createManual(
        {
          organizationId: otherOrganization.id,
          customerId: customerTwo.id,
          registeredByEmployeeId: employeeTwo.id,
          externalTrackingNumber: TRACKING_ONE,
          externalTrackingNumberNormalized: TRACKING_ONE_NORMALIZED,
          notes: null,
        },
        secondContext,
      );
      cleanup.packageIds.push(crossTenantManual.id);

      const cancelledManual = await repository.cancel(
        organization.id,
        createdManual.id,
        'Duplicate registration during identification',
        firstContext,
      );
      expect(cancelledManual?.status).toBe('CANCELLED');
      expect(cancelledManual?.cancellationReason).toBe(
        'Duplicate registration during identification',
      );

      const recreatedManual = await repository.createManual(
        {
          organizationId: organization.id,
          customerId: customerOne.id,
          registeredByEmployeeId: employeeOne.id,
          externalTrackingNumber: TRACKING_ONE,
          externalTrackingNumberNormalized: TRACKING_ONE_NORMALIZED,
          notes: null,
        },
        firstContext,
      );
      cleanup.packageIds.push(recreatedManual.id);

      const pendingPrealert = await prisma.prealert.create({
        data: {
          organizationId: organization.id,
          customerId: customerOne.id,
          createdByEmployeeId: employeeOne.id,
          prealertCode: buildCode('PA', 10),
          externalTrackingNumber: TRACKING_PREALERT,
          externalTrackingNumberNormalized: TRACKING_PREALERT_NORMALIZED,
          storeName: 'Amazon',
          description: 'Prealerted package',
          quantity: 1,
          declaredValue: '10.00',
          currencyCode: 'USD',
          invoiceStatus: 'PENDING',
          status: 'PENDING_ARRIVAL',
        },
      });
      cleanup.prealertIds.push(pendingPrealert.id);

      await expect(
        repository.createManual(
          {
            organizationId: organization.id,
            customerId: customerOne.id,
            registeredByEmployeeId: employeeOne.id,
            externalTrackingNumber: TRACKING_PREALERT,
            externalTrackingNumberNormalized: TRACKING_PREALERT_NORMALIZED,
            notes: null,
          },
          firstContext,
        ),
      ).rejects.toBeInstanceOf(PackagePrealertMatchRequiredError);

      const matchedPackage = await repository.createFromPrealert(
        {
          organizationId: organization.id,
          prealertId: pendingPrealert.id,
          registeredByEmployeeId: employeeOne.id,
          notes: 'Registered from matched prealert',
        },
        firstContext,
      );
      cleanup.packageIds.push(matchedPackage.id);

      expect(matchedPackage.source).toBe('PREALERT');
      expect(matchedPackage.prealert).toMatchObject({
        id: pendingPrealert.id,
        prealertCode: pendingPrealert.prealertCode,
      });
      expect(matchedPackage.customer.id).toBe(customerOne.id);

      const reloadedPrealert = await prisma.prealert.findUniqueOrThrow({
        where: { id: pendingPrealert.id },
        select: { status: true },
      });
      expect(reloadedPrealert.status).toBe('MATCHED');

      const prealertDetail = await prisma.prealert.findFirstOrThrow({
        where: { id: pendingPrealert.id, organizationId: organization.id },
        include: {
          packages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
      });
      expect(prealertDetail.packages[0]?.id).toBe(matchedPackage.id);

      await expect(
        repository.createFromPrealert(
          {
            organizationId: organization.id,
            prealertId: pendingPrealert.id,
            registeredByEmployeeId: employeeOne.id,
            notes: null,
          },
          firstContext,
        ),
      ).rejects.toBeInstanceOf(PackagePrealertUnavailableError);

      const packageCreatedCountBeforeCancel = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'PACKAGE',
          entityId: matchedPackage.id,
          action: 'package.cancelled',
        },
      });
      const prealertReopenedCountBeforeCancel = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'PREALERT',
          entityId: pendingPrealert.id,
          action: 'prealert.reopened',
        },
      });

      const cancelledMatched = await repository.cancel(
        organization.id,
        matchedPackage.id,
        'Manual duplication review',
        firstContext,
      );
      expect(cancelledMatched?.status).toBe('CANCELLED');

      const reopenedPrealert = await prisma.prealert.findUniqueOrThrow({
        where: { id: pendingPrealert.id },
        select: { status: true },
      });
      expect(reopenedPrealert.status).toBe('PENDING_ARRIVAL');

      const cancelledAgain = await repository.cancel(
        organization.id,
        matchedPackage.id,
        'Manual duplication review',
        firstContext,
      );
      expect(cancelledAgain?.status).toBe('CANCELLED');

      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'PACKAGE',
            entityId: matchedPackage.id,
            action: 'package.cancelled',
          },
        }),
      ).toBe(packageCreatedCountBeforeCancel + 1);
      expect(
        await prisma.auditLog.count({
          where: {
            organizationId: organization.id,
            entityType: 'PREALERT',
            entityId: pendingPrealert.id,
            action: 'prealert.reopened',
          },
        }),
      ).toBe(prealertReopenedCountBeforeCancel + 1);
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

  it('rolls back package creation when audit or outbox persistence fails', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      customerIds: [] as string[],
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
      const repository = moduleRef.get<PackagesRepository>(PackagesRepository);
      const suffix = randomUUID();

      const organization = await prisma.organization.create({
        data: {
          legalName: `Packages Rollback ${suffix}`,
          commercialName: `Packages Rollback ${suffix}`,
          slug: `packages-rollback-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: organization.id },
      });

      const user = await prisma.user.create({
        data: {
          email: `packages.rollback.${suffix}@courier.test`,
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          firstName: 'Alan',
          lastName: 'Turing',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employee.id);

      const customer = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: 'PKG-ROLLBACK',
          type: 'INDIVIDUAL',
          firstName: 'Alan',
          lastName: 'Turing',
          status: 'ACTIVE',
        },
      });
      cleanup.customerIds.push(customer.id);

      const context = buildContext(organization.id, employee.id, user.id);

      const failingAuditSpy = jest
        .spyOn(PrismaAuditOutboxWriter.prototype, 'write')
        .mockRejectedValueOnce(new Error('forced package audit failure'));

      await expect(
        repository.createManual(
          {
            organizationId: organization.id,
            customerId: customer.id,
            registeredByEmployeeId: employee.id,
            externalTrackingNumber: '9400-0000-0000-0000-0000-00',
            externalTrackingNumberNormalized: '9400000000000000000000',
            notes: null,
          },
          context,
        ),
      ).rejects.toThrow('forced package audit failure');

      failingAuditSpy.mockRestore();

      expect(
        await prisma.package.count({
          where: {
            organizationId: organization.id,
            externalTrackingNumberNormalized: '9400000000000000000000',
          },
        }),
      ).toBe(0);

      const auditCountBeforeOutboxFailure = await prisma.auditLog.count({
        where: {
          organizationId: organization.id,
          entityType: 'PACKAGE',
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
          throw new Error('forced package outbox failure');
        });

      await expect(
        repository.createManual(
          {
            organizationId: organization.id,
            customerId: customer.id,
            registeredByEmployeeId: employee.id,
            externalTrackingNumber: '9400-1111-1111-1111-1111-11',
            externalTrackingNumberNormalized: '9400111111111111111111',
            notes: null,
          },
          context,
        ),
      ).rejects.toThrow('forced package outbox failure');

      failingOutboxSpy.mockRestore();

      expect(
        await prisma.package.count({
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
            entityType: 'PACKAGE',
          },
        }),
      ).toBe(auditCountBeforeOutboxFailure);
    } finally {
      if (prismaService) {
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

function buildCode(prefix: 'PA', length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = prefix;

  while (value.length < prefix.length + length) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}
