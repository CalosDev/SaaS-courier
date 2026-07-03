import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AuthCookieService } from '../src/auth/http/auth-cookie.service';
import { PrismaAuditOutboxWriter } from '../src/audit/prisma-audit-outbox.writer';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PasswordHasher } from '../src/accounts/password-hasher';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/rbac/rbac.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { SessionsService } from '../src/sessions/sessions.service';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

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

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
  });

  it('requires audit.read and returns only safe records from the active tenant', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app);
      await app.init();

      const database = moduleRef.get(PrismaService);
      prisma = database;
      const passwordHasher = moduleRef.get(PasswordHasher);
      const rbacService = moduleRef.get(RbacService);
      const sessionsService = moduleRef.get(SessionsService);
      const authCookieService = moduleRef.get(AuthCookieService);
      const writer = new PrismaAuditOutboxWriter();
      await rbacService.syncPermissionCatalog();

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
      const session = await sessionsService.createSession({
        userId: user.id,
        organizationId: organizations[0].id,
      });
      cleanup.sessionIds.push(session.session.sessionId);

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

      const server = app.getHttpServer() as Parameters<typeof request>[0];
      await request(server).get('/audit-logs').expect(401);
      const response = await request(server)
        .get('/audit-logs?page=1&pageSize=20')
        .set(
          'Cookie',
          `${authCookieService.getSessionCookieName()}=${session.sessionToken}`,
        )
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
        await deleteAuditArtifactsForOrganizations(
          database,
          cleanup.organizationIds,
        );
        await database.userSession.deleteMany({
          where: { id: { in: cleanup.sessionIds } },
        });
        await database.employeeRole.deleteMany({
          where: { employeeId: { in: cleanup.employeeIds } },
        });
        await database.rolePermission.deleteMany({
          where: { roleId: { in: cleanup.roleIds } },
        });
        await database.role.deleteMany({
          where: { id: { in: cleanup.roleIds } },
        });
        await database.employee.deleteMany({
          where: { id: { in: cleanup.employeeIds } },
        });
        await database.user.deleteMany({
          where: { id: { in: cleanup.userIds } },
        });
        await database.organization.deleteMany({
          where: { id: { in: cleanup.organizationIds } },
        });
      }
      await app?.close();
      await moduleRef?.close();
    }
  }, 90000);
});
