import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { ReportsService } from '../src/reports/reports.service';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

describe('Reports repository integration', () => {
  it('isolates reports and processes idempotent, safe, expiring exports', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const organizationIds: string[] = [];
    const userIds: string[] = [];
    const employeeIds: string[] = [];
    const customerIds: string[] = [];
    const packageIds: string[] = [];
    const exportIds: string[] = [];

    try {
      process.env.NODE_ENV = 'test';
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const reports = moduleRef.get(ReportsService);
      const suffix = randomUUID();

      const organizations = await Promise.all(
        ['one', 'two'].map((label) =>
          prisma.organization.create({
            data: {
              legalName: `Reports ${label} ${suffix}`,
              commercialName: `Reports ${label}`,
              slug: `reports-${label}-${suffix}`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      organizationIds.push(...organizations.map((item) => item.id));

      const users = await Promise.all(
        organizations.map((_, index) =>
          prisma.user.create({
            data: {
              email: `reports.${index}.${suffix}@courier.test`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      userIds.push(...users.map((item) => item.id));

      const employees = await Promise.all(
        organizations.map((organization, index) =>
          prisma.employee.create({
            data: {
              organizationId: organization.id,
              userId: users[index].id,
              firstName: 'Report',
              lastName: `Operator ${index}`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      employeeIds.push(...employees.map((item) => item.id));

      const customers = await Promise.all(
        organizations.map((organization, index) =>
          prisma.customer.create({
            data: {
              organizationId: organization.id,
              customerCode: `RPT${index}${suffix.slice(0, 8).toUpperCase()}`,
              type: 'INDIVIDUAL',
              firstName: 'Customer',
              lastName: `${index}`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      customerIds.push(...customers.map((item) => item.id));

      const packages = await Promise.all(
        organizations.map((organization, index) =>
          prisma.package.create({
            data: {
              organizationId: organization.id,
              customerId: customers[index].id,
              registeredByEmployeeId: employees[index].id,
              internalTrackingNumber:
                index === 0 ? 'PKABCDEFGH2345' : 'PKABCDEFGH2346',
              externalTrackingNumber:
                index === 0 ? 'REPORT-TRACK-1' : 'OTHER-TENANT',
              externalTrackingNumberNormalized:
                index === 0 ? 'REPORTTRACK1' : 'OTHERTENANT',
            },
          }),
        ),
      );
      packageIds.push(...packages.map((item) => item.id));

      const contexts = organizations.map((organization, index) =>
        buildContext(organization.id, employees[index].id, users[index].id),
      );
      const operations = await reports.getOperationsReport(
        organizations[0].id,
        {},
      );
      expect(operations.data.total).toBe(1);

      const first = await reports.requestExport(
        contexts[0],
        { reportType: 'OPERATIONS' },
        'reports-e2e-key',
      );
      const repeated = await reports.requestExport(
        contexts[0],
        { reportType: 'OPERATIONS' },
        'reports-e2e-key',
      );
      exportIds.push(first.id);
      expect(repeated.id).toBe(first.id);

      await reports.processPendingExports();
      const completed = await reports.getExport(organizations[0].id, first.id);
      expect(completed).toMatchObject({
        status: 'COMPLETED',
        rowCount: 1,
        truncated: false,
      });
      expect(completed.content).toBeUndefined();

      await expect(
        reports.getExport(organizations[1].id, first.id),
      ).rejects.toBeInstanceOf(NotFoundException);

      const download = await reports.downloadExport(contexts[0], first.id);
      expect(download.content).toContain('REPORT-TRACK-1');
      expect(download.content).not.toContain('OTHER-TENANT');

      const actions = await prisma.auditLog.findMany({
        where: {
          organizationId: organizations[0].id,
          entityType: 'REPORT_EXPORT',
          entityId: first.id,
        },
        orderBy: { createdAt: 'asc' },
        select: { action: true },
      });
      expect(actions.map((item) => item.action)).toEqual([
        'report_export.requested',
        'report_export.completed',
        'report_export.downloaded',
      ]);
      expect(
        await prisma.outboxEvent.count({
          where: {
            organizationId: organizations[0].id,
            aggregateType: 'REPORT_EXPORT',
            aggregateId: first.id,
            eventType: 'report_export.requested',
          },
        }),
      ).toBe(1);

      await prisma.reportExportJob.update({
        where: { id: first.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(
        reports.getExport(organizations[0].id, first.id),
      ).resolves.toMatchObject({
        status: 'EXPIRED',
        content: undefined,
      });
    } finally {
      if (prismaService) {
        await prismaService.reportExportJob.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.package.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.customer.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.employee.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.user.deleteMany({ where: { id: { in: userIds } } });
        await deleteAuditArtifactsForOrganizations(
          prismaService,
          organizationIds,
        );
        await prismaService.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      if (app) await app.close();
      if (moduleRef) await moduleRef.close();
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
