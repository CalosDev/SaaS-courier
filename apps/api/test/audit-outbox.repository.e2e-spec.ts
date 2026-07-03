import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { PrismaAuditOutboxWriter } from '../src/audit/prisma-audit-outbox.writer';
import { PrismaAuditRepository } from '../src/audit/prisma-audit.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Audit and transactional outbox integration', () => {
  let moduleRef: TestingModule | null = null;
  let prisma: PrismaService | null = null;
  const organizationIds: string[] = [];

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
  });

  it('keeps domain, audit and outbox atomic, immutable and tenant-scoped', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const database = moduleRef.get(PrismaService);
      prisma = database;
      const writer = new PrismaAuditOutboxWriter();
      const repository = new PrismaAuditRepository(database);
      const suffix = randomUUID();
      const firstOrganization = await database.organization.create({
        data: {
          legalName: `Audit One ${suffix}`,
          commercialName: `Audit One ${suffix}`,
          slug: `audit-one-${suffix}`,
          status: 'ACTIVE',
        },
      });
      const secondOrganization = await database.organization.create({
        data: {
          legalName: `Audit Two ${suffix}`,
          commercialName: `Audit Two ${suffix}`,
          slug: `audit-two-${suffix}`,
          status: 'ACTIVE',
        },
      });
      organizationIds.push(firstOrganization.id, secondOrganization.id);

      const firstContext = buildContext(firstOrganization.id);
      const secondContext = buildContext(secondOrganization.id);

      await expect(
        database.$transaction(async (tx) => {
          await tx.organization.update({
            where: { id: firstOrganization.id },
            data: { commercialName: 'Must Roll Back' },
          });
          await writer.write(tx, {
            context: firstContext,
            action: 'organization.updated',
            entityType: 'ORGANIZATION',
            entityId: firstOrganization.id,
            changedFields: ['commercialName'],
            payload: { organizationId: firstOrganization.id },
            idempotencyKey: `rollback-domain-${suffix}`,
          });
          throw new Error('forced domain failure');
        }),
      ).rejects.toThrow('forced domain failure');

      expect(
        await database.organization.findUniqueOrThrow({
          where: { id: firstOrganization.id },
          select: { commercialName: true },
        }),
      ).toEqual({ commercialName: firstOrganization.commercialName });
      expect(
        await database.auditLog.count({
          where: { requestId: firstContext.requestId },
        }),
      ).toBe(0);

      const duplicateKey = `shared-key-${suffix}`;
      await expect(
        database.$transaction(async (tx) => {
          await tx.organization.update({
            where: { id: firstOrganization.id },
            data: { commercialName: 'Must Also Roll Back' },
          });
          await writer.write(tx, {
            context: firstContext,
            action: 'organization.updated',
            entityType: 'ORGANIZATION',
            entityId: firstOrganization.id,
            changedFields: ['commercialName'],
            payload: { organizationId: firstOrganization.id },
            idempotencyKey: duplicateKey,
          });
          await writer.write(tx, {
            context: firstContext,
            action: 'organization.updated',
            entityType: 'ORGANIZATION',
            entityId: firstOrganization.id,
            changedFields: ['commercialName'],
            payload: { organizationId: firstOrganization.id },
            idempotencyKey: duplicateKey,
          });
        }),
      ).rejects.toBeDefined();
      expect(
        await database.auditLog.count({
          where: { requestId: firstContext.requestId },
        }),
      ).toBe(0);

      for (const context of [firstContext, secondContext]) {
        await database.$transaction((tx) =>
          writer.write(tx, {
            context,
            action: 'organization.updated',
            entityType: 'ORGANIZATION',
            entityId: context.organizationId,
            changedFields: ['commercialName'],
            afterData: { commercialName: 'Audited' },
            payload: { organizationId: context.organizationId },
            idempotencyKey: duplicateKey,
          }),
        );
      }

      const firstTenantLogs = await repository.list({
        organizationId: firstOrganization.id,
        page: 1,
        pageSize: 20,
      });
      expect(firstTenantLogs.items).toHaveLength(1);
      expect(firstTenantLogs.items[0]?.entityId).toBe(firstOrganization.id);

      const auditLog = await database.auditLog.findFirstOrThrow({
        where: { organizationId: firstOrganization.id },
      });
      const outboxEvent = await database.outboxEvent.findFirstOrThrow({
        where: { organizationId: firstOrganization.id },
      });
      expect(outboxEvent.status).toBe('PENDING');

      await expect(
        database.auditLog.update({
          where: { id: auditLog.id },
          data: { action: 'tampered' },
        }),
      ).rejects.toBeDefined();
      await expect(
        database.auditLog.delete({ where: { id: auditLog.id } }),
      ).rejects.toBeDefined();
      await expect(
        database.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: { payload: { tampered: true } },
        }),
      ).rejects.toBeDefined();
    } finally {
      const database = prisma;
      if (database && organizationIds.length > 0) {
        await deleteAuditArtifactsForOrganizations(database, organizationIds);
        await database.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      await moduleRef?.close();
    }
  }, 60000);
});

function buildContext(organizationId: string): CommandContext {
  return {
    organizationId,
    actorType: 'EMPLOYEE',
    actorUserId: randomUUID(),
    actorEmployeeId: randomUUID(),
    source: 'HTTP',
    requestId: randomUUID(),
    correlationId: randomUUID(),
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
}
