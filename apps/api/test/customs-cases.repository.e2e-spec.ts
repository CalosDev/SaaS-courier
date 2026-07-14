import {
  BadRequestException,
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { CustomsCasesService } from '../src/customs-cases/customs-cases.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Customs cases integration', () => {
  it('preserves truthful append-only evidence and controlled tenant-safe statuses', async () => {
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
      const service = moduleRef.get(CustomsCasesService);
      const first = await seedTenant(db, 'first');
      const second = await seedTenant(db, 'second');
      organizationIds.push(first.organizationId, second.organizationId);
      userIds.push(first.userId, second.userId);

      const customsCase = await service.create(first.context, {
        caseNumber: 'DGA-2026-0001',
      });
      await expect(
        service.create(first.context, { caseNumber: 'DGA-2026-0001' }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.findById(second.context, customsCase.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.recordEvent(first.context, customsCase.id, {
          source: 'AUTHORIZED_INTEGRATION',
          eventDate: new Date().toISOString(),
          description: 'Imported automatically',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.recordEvent(first.context, customsCase.id, {
          source: 'OFFICIAL_PORTAL',
          eventDate: new Date().toISOString(),
          description: 'Portal review',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.recordEvent(first.context, customsCase.id, {
          source: 'MANUAL',
          eventDate: new Date().toISOString(),
          description: '<script>cookie=session-token</script>',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const event = await service.recordEvent(first.context, customsCase.id, {
        source: 'OFFICIAL_PORTAL',
        eventDate: new Date().toISOString(),
        description: 'Consulta manual al portal oficial',
        evidenceReference: 'DGA-CONSULTA-4455',
      });
      expect(event).toMatchObject({
        evidenceReference: 'DGA-CONSULTA-4455',
        recordedByEmployeeId: first.employeeId,
      });
      await expect(
        db.customsCaseEvent.update({
          where: {
            organizationId_id: {
              organizationId: first.organizationId,
              id: event.id,
            },
          },
          data: { description: 'Changed' },
        }),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.customsCaseEvent.delete({
          where: {
            organizationId_id: {
              organizationId: first.organizationId,
              id: event.id,
            },
          },
        }),
      ).rejects.toThrow(/append-only/);

      await service.changeStatus(first.context, customsCase.id, {
        status: 'UNDER_REVIEW',
      });
      await service.changeStatus(first.context, customsCase.id, {
        status: 'RELEASED',
      });
      const repeated = await service.changeStatus(
        first.context,
        customsCase.id,
        { status: 'RELEASED' },
      );
      expect(repeated.status).toBe('RELEASED');
      await expect(
        service.changeStatus(first.context, customsCase.id, { status: 'HELD' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        await db.outboxEvent.count({
          where: {
            organizationId: first.organizationId,
            aggregateId: customsCase.id,
            eventType: 'customs_case.status.changed',
          },
        }),
      ).toBe(2);
      expect(
        await db.outboxEvent.count({
          where: {
            organizationId: first.organizationId,
            aggregateId: customsCase.id,
            eventType: {
              in: ['customs_case.created', 'customs_case.event.recorded'],
            },
          },
        }),
      ).toBe(0);
    } finally {
      if (prisma) {
        await deleteAuditArtifactsForOrganizations(prisma, organizationIds);
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            "SET LOCAL app.allow_append_only_cleanup = 'on'",
          );
          await tx.customsCaseEvent.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
          await tx.customsCase.deleteMany({
            where: { organizationId: { in: organizationIds } },
          });
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
  const organization = await prisma.organization.create({
    data: {
      legalName: `Customs ${label}`,
      commercialName: `Customs ${label}`,
      slug: `customs-${label}-${suffix}`,
      status: 'ACTIVE',
    },
  });
  await prisma.organizationSettings.create({
    data: { organizationId: organization.id },
  });
  const user = await prisma.user.create({
    data: {
      email: `customs.${label}.${suffix}@courier.test`,
      status: 'ACTIVE',
    },
  });
  const employee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      firstName: 'Customs',
      lastName: label,
      status: 'ACTIVE',
    },
  });
  return {
    organizationId: organization.id,
    userId: user.id,
    employeeId: employee.id,
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
