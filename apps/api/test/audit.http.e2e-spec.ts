import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaAuditOutboxWriter } from '../src/audit/prisma-audit-outbox.writer';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import {
  cleanupCoreHttpTestData,
  configureHttpE2eEnvironment,
  createAuthenticatedHttpSession,
  createHttpE2eContext,
} from './http-e2e-test-kit';

describe('Audit HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prisma: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(configureHttpE2eEnvironment);

  it('requires audit.read and returns only safe records from the active tenant', async () => {
    try {
      const httpContext = await createHttpE2eContext();
      moduleRef = httpContext.moduleRef;
      app = httpContext.app;
      const {
        prisma: database,
        passwordHasher,
        rbacService,
        sessionsService,
        authCookieService,
        server,
      } = httpContext;
      prisma = database;
      const writer = new PrismaAuditOutboxWriter();

      const suffix = randomUUID();
      const organizations = await Promise.all(
        ['One', 'Two'].map((label) =>
          database.organization.create({
            data: {
              legalName: `Audit HTTP ${label} ${suffix}`,
              commercialName: `Audit HTTP ${label} ${suffix}`,
              slug: `audit-http-${label.toLowerCase()}-${suffix}`,
              status: 'ACTIVE',
            },
          }),
        ),
      );
      cleanup.organizationIds.push(...organizations.map(({ id }) => id));
      const user = await database.user.create({
        data: {
          email: `audit-http.${suffix}@courier.test`,
          passwordHash: await passwordHasher.hash(
            'Correct Horse Battery Staple 123!',
          ),
          emailVerifiedAt: new Date('2026-07-02T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);
      const employee = await database.employee.create({
        data: {
          organizationId: organizations[0].id,
          userId: user.id,
          firstName: 'Audit',
          lastName: 'Reader',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employee.id);
      const role = await rbacService.createRole({
        organizationId: organizations[0].id,
        code: `AUDIT_${suffix.slice(0, 8).toUpperCase()}`,
        name: 'Audit Reader',
        permissionCodes: ['audit.read'],
      });
      cleanup.roleIds.push(role.id);
      await rbacService.assignRoleToEmployee({
        organizationId: organizations[0].id,
        employeeId: employee.id,
        roleId: role.id,
      });
      const session = await createAuthenticatedHttpSession({
        sessionsService,
        authCookieService,
        userId: user.id,
        organizationId: organizations[0].id,
        cleanupSessionIds: cleanup.sessionIds,
      });

      for (const organization of organizations) {
        const context: CommandContext = {
          organizationId: organization.id,
          actorType: 'EMPLOYEE',
          actorUserId: user.id,
          actorEmployeeId: employee.id,
          source: 'HTTP',
          requestId: randomUUID(),
          correlationId: randomUUID(),
          ipAddress: '127.0.0.1',
          userAgent: 'sensitive-agent',
        };
        await database.$transaction((tx) =>
          writer.write(tx, {
            context,
            action: 'organization.updated',
            entityType: 'ORGANIZATION',
            entityId: organization.id,
            changedFields: ['commercialName'],
            afterData: { commercialName: 'Safe value' },
            metadata: { internalMarker: 'not returned' },
            payload: { organizationId: organization.id },
          }),
        );
      }

      await request(server).get('/audit-logs').expect(401);
      const response = await request(server)
        .get('/audit-logs?page=1&pageSize=20')
        .set('Cookie', session.sessionCookie)
        .expect(200);
      const body = response.body as {
        items: Array<Record<string, unknown>>;
        pagination: { totalItems: number };
      };

      expect(response.headers['cache-control']).toBe('no-store');
      expect(body.pagination.totalItems).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.entityId).toBe(organizations[0].id);
      expect(body.items[0]).not.toHaveProperty('organizationId');
      expect(body.items[0]).not.toHaveProperty('actorUserId');
      expect(body.items[0]).not.toHaveProperty('ipAddress');
      expect(body.items[0]).not.toHaveProperty('userAgent');
      expect(body.items[0]).not.toHaveProperty('metadata');
    } finally {
      const database = prisma;
      if (database) {
        await cleanupCoreHttpTestData(database, cleanup);
      }
      await app?.close();
      await moduleRef?.close();
    }
  }, 90000);
});
