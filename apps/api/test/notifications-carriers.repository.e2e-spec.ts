import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac, randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { CarrierConnectionsService } from '../src/carrier-integrations/carrier-connections.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

describe('Notifications and carriers repository integration', () => {
  it('keeps delivery and carrier evidence idempotent, tenant-safe and independent', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prisma: PrismaService | null = null;
    const organizationIds: string[] = [];
    const userIds: string[] = [];

    try {
      process.env.NODE_ENV = 'test';
      process.env.CARRIER_SECRET_CARRIER_E2E = 'carrier-e2e-secret';
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      const db = moduleRef.get(PrismaService);
      prisma = db;
      const notifications = moduleRef.get(NotificationsService);
      const carriers = moduleRef.get(CarrierConnectionsService);
      const suffix = randomUUID();
      const organizations = await Promise.all(
        ['one', 'two'].map((label) =>
          db.organization.create({
            data: {
              legalName: `Integrations ${label} ${suffix}`,
              commercialName: `Integrations ${label}`,
              slug: `integrations-${label}-${suffix}`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      organizationIds.push(...organizations.map((item) => item.id));

      const users = await Promise.all(
        organizations.map((_, index) =>
          db.user.create({
            data: {
              email: `integrations.${index}.${suffix}@courier.test`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      userIds.push(...users.map((item) => item.id));
      const employees = await Promise.all(
        organizations.map((organization, index) =>
          db.employee.create({
            data: {
              organizationId: organization.id,
              userId: users[index].id,
              firstName: 'Integration',
              lastName: `Operator ${index}`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      const customers = await Promise.all(
        organizations.map((organization, index) =>
          db.customer.create({
            data: {
              organizationId: organization.id,
              customerCode: `INT${index}${suffix.slice(0, 8).toUpperCase()}`,
              type: 'INDIVIDUAL',
              firstName: 'Customer',
              lastName: `${index}`,
              email: `customer.${index}.${suffix}@courier.test`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      const packages = await Promise.all(
        organizations.map((organization, index) =>
          db.package.create({
            data: {
              organizationId: organization.id,
              customerId: customers[index].id,
              registeredByEmployeeId: employees[index].id,
              internalTrackingNumber:
                index === 0 ? 'PKABCDEFGH2362' : 'PKABCDEFGH2363',
              externalTrackingNumber:
                index === 0 ? 'CARRIER-E2E-1' : 'FOREIGN-1',
              externalTrackingNumberNormalized:
                index === 0 ? 'CARRIERE2E1' : 'FOREIGN1',
            },
          }),
        ),
      );
      const context = commandContext(
        organizations[0].id,
        employees[0].id,
        users[0].id,
      );

      const template = await notifications.createTemplate(context, {
        code: 'E2E_PACKAGE_RECEIVED',
        eventType: 'package.received',
        subjectTemplate: 'Paquete {{trackingNumber}}',
        bodyTemplate: '{{customerCode}} {{status}}',
        allowedVariables: ['trackingNumber', 'customerCode', 'status'],
      });
      const outboxId = randomUUID();
      const event = {
        id: outboxId,
        organization_id: organizations[0].id,
        event_type: 'package.received',
        aggregate_type: 'PACKAGE',
        aggregate_id: packages[0].id,
        payload: {
          trackingNumber: 'PKABCDEFGH2362',
          status: 'RECEIVED_AT_ORIGIN',
        },
      };
      await notifications.consumeOutboxEvent(event);
      await notifications.consumeOutboxEvent(event);
      expect(
        await db.notificationDelivery.count({
          where: {
            organizationId: organizations[0].id,
            templateId: template.id,
          },
        }),
      ).toBe(1);

      const connection = await carriers.create(context, {
        carrierCode: 'UPS',
        displayName: 'UPS E2E',
        secretReference: 'CARRIER_E2E',
        status: 'ACTIVE',
      });
      const occurredAt = new Date().toISOString();
      const timestamp = String(Date.now());
      const canonical = `{"occurredAt":"${occurredAt}","status":"DELIVERED","trackingNumber":"CARRIER-E2E-1"}`;
      const signature = createHmac('sha256', 'carrier-e2e-secret')
        .update(`${timestamp}.${canonical}`)
        .digest('hex');
      const carrierEvent = {
        connectionKey: connection.connectionKey,
        eventId: 'provider-event-e2e-1',
        timestamp,
        signature,
        body: {
          trackingNumber: 'CARRIER-E2E-1',
          status: 'DELIVERED' as const,
          occurredAt,
        },
      };

      await expect(carriers.receiveWebhook(carrierEvent)).resolves.toEqual({
        accepted: true,
        duplicate: false,
      });
      await expect(carriers.receiveWebhook(carrierEvent)).resolves.toEqual({
        accepted: true,
        duplicate: true,
      });
      expect(
        await db.carrierTrackingSnapshot.count({
          where: {
            organizationId: organizations[0].id,
            packageId: packages[0].id,
          },
        }),
      ).toBe(1);
      expect(
        await db.package.findUniqueOrThrow({
          where: { id: packages[0].id },
          select: { status: true },
        }),
      ).toEqual({ status: 'RECEPTION_PENDING' });
      await expect(
        carriers.listPackageEvents(organizations[1].id, packages[0].id),
      ).rejects.toBeInstanceOf(NotFoundException);
    } finally {
      if (prisma) {
        await prisma.notificationDelivery.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.notificationTemplate.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.allow_append_only_cleanup', 'on', true)`;
          await tx.carrierTrackingSnapshot.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
          await tx.carrierWebhookReceipt.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
        });
        await prisma.carrierConnection.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.package.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.customer.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await deleteAuditArtifactsForOrganizations(prisma, organizationIds);
        await prisma.employee.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      if (app) await app.close();
      if (moduleRef) await moduleRef.close();
      delete process.env.CARRIER_SECRET_CARRIER_E2E;
    }
  }, 120000);
});

function commandContext(
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
