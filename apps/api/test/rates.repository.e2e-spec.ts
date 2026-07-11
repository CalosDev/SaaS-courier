import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { RatesRepository } from '../src/rates/rates.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

describe('Rates repository integration', () => {
  it('creates services, rate cards, and rules atomically with audit logs', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      serviceIds: [] as string[],
      rateCardIds: [] as string[],
    };

    try {
      process.env.NODE_ENV = 'test';

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const repository = moduleRef.get<RatesRepository>(RatesRepository);
      const suffix = randomUUID();

      const organization = await prisma.organization.create({
        data: {
          legalName: `Rates Org ${suffix}`,
          commercialName: `Rates Org ${suffix}`,
          slug: `rates-org-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: organization.id },
      });

      const userOne = await prisma.user.create({
        data: {
          email: `rates.one.${suffix}@courier.test`,
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(userOne.id);

      const employeeOne = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: userOne.id,
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeOne.id);

      const context = buildContext(organization.id, employeeOne.id, userOne.id);

      // Create Courier Service
      const createdService = await repository.createService(
        {
          organizationId: organization.id,
          code: 'EXP',
          name: 'Express Delivery',
          description: null,
          isActive: true,
        },
        context,
      );
      cleanup.serviceIds.push(createdService.id);

      expect(createdService.code).toBe('EXP');

      // Verify Audit Log
      const serviceAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          entityType: 'COURIER_SERVICE',
          entityId: createdService.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(serviceAudit.action).toBe('service.created');

      // Create Rate Card
      const createdCard = await repository.createRateCard(
        {
          organizationId: organization.id,
          serviceId: createdService.id,
          name: 'Express Default',
          segmentKey: 'DEFAULT',
          segmentName: 'Default Segment',
          calculationType: 'FLAT',
          currencyCode: 'DOP',
          weightUnit: 'LB',
        },
        context,
      );
      cleanup.rateCardIds.push(createdCard.id);

      expect(createdCard.status).toBe('DRAFT');
      expect(createdCard.version).toBe(1);

      // Verify Audit Log
      const cardAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          entityType: 'RATE_CARD',
          entityId: createdCard.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(cardAudit.action).toBe('rate_card.created');

      // Replace Rules
      const replacedCard = await repository.replaceRateRules(
        {
          organizationId: organization.id,
          rateCardId: createdCard.id,
          rules: [
            {
              sortOrder: 1,
              minWeight: null,
              maxWeight: null,
              flatAmountMinor: 150000n,
              unitAmountMinor: null,
            },
          ],
          currencyCode: 'DOP',
          weightUnit: 'LB',
        },
        context,
      );

      expect(replacedCard?.rules.length).toBe(1);
      expect(replacedCard?.rules[0]?.flatAmountMinor).toBe(150000n);

      // Verify Audit Log
      const rulesAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          entityType: 'RATE_CARD',
          entityId: createdCard.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(rulesAudit.action).toBe('rate_rules.replaced');

      // Activate Rate Card
      const activatedCard = await repository.activateRateCard(
        organization.id,
        createdCard.id,
        context,
      );

      expect(activatedCard?.status).toBe('ACTIVE');

      // Verify Audit and Outbox
      const activateAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          entityType: 'RATE_CARD',
          entityId: createdCard.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(activateAudit.action).toBe('rate_card.activated');

      const activateOutbox = await prisma.outboxEvent.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          aggregateType: 'RATE_CARD',
          aggregateId: createdCard.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(activateOutbox.eventType).toBe('rate_card.activated');
    } finally {
      if (prismaService) {
        if (cleanup.rateCardIds.length > 0) {
          await prismaService.rateRule.deleteMany({
            where: { rateCardId: { in: cleanup.rateCardIds } },
          });
          await prismaService.rateCard.deleteMany({
            where: { id: { in: cleanup.rateCardIds } },
          });
        }
        if (cleanup.serviceIds.length > 0) {
          await prismaService.courierService.deleteMany({
            where: { id: { in: cleanup.serviceIds } },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employee.deleteMany({
            where: { id: { in: cleanup.employeeIds } },
          });
        }
        if (cleanup.userIds.length > 0) {
          await prismaService.user.deleteMany({
            where: { id: { in: cleanup.userIds } },
          });
        }
        if (cleanup.organizationIds.length > 0) {
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
