import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  Test,
  type TestingModule,
  type TestingModuleBuilder,
} from '@nestjs/testing';
import request from 'supertest';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { AppModule } from '../src/app.module';
import { AuthCookieService } from '../src/auth/http/auth-cookie.service';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/rbac/rbac.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

export const HTTP_TEST_ORIGIN = 'http://localhost:3000';

const LOCAL_DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

export type HttpE2eContext = {
  app: NestExpressApplication;
  moduleRef: TestingModule;
  prisma: PrismaService;
  passwordHasher: PasswordHasher;
  rbacService: RbacService;
  sessionsService: SessionsService;
  authCookieService: AuthCookieService;
  server: Parameters<typeof request>[0];
};

export type CoreHttpTestCleanup = {
  organizationIds: string[];
  userIds: string[];
  employeeIds: string[];
  roleIds: string[];
  sessionIds: string[];
  facilityIds?: string[];
  customerIds?: string[];
};

export function configureHttpE2eEnvironment(): void {
  process.env.DATABASE_URL = LOCAL_DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.COOKIE_SECURE = 'false';
  process.env.CORS_ORIGINS = HTTP_TEST_ORIGIN;
}

export async function createHttpE2eContext(
  configureModule?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<HttpE2eContext> {
  const baseBuilder = Test.createTestingModule({
    imports: [AppModule],
  });
  const moduleRef = await (
    configureModule ? configureModule(baseBuilder) : baseBuilder
  ).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureHttpApp(app);
  await app.init();

  const rbacService = moduleRef.get(RbacService);
  await rbacService.syncPermissionCatalog();

  return {
    app,
    moduleRef,
    prisma: moduleRef.get(PrismaService),
    passwordHasher: moduleRef.get(PasswordHasher),
    rbacService,
    sessionsService: moduleRef.get(SessionsService),
    authCookieService: moduleRef.get(AuthCookieService),
    server: app.getHttpServer() as Parameters<typeof request>[0],
  };
}

export async function createAuthenticatedHttpSession(input: {
  sessionsService: SessionsService;
  authCookieService: AuthCookieService;
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
  cleanupSessionIds?: string[];
}): Promise<{ sessionId: string; sessionCookie: string }> {
  const session = await input.sessionsService.createSession({
    userId: input.userId,
    organizationId: input.organizationId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  const sessionId = session.session.sessionId;
  input.cleanupSessionIds?.push(sessionId);

  return {
    sessionId,
    sessionCookie: `${input.authCookieService.getSessionCookieName()}=${session.sessionToken}`,
  };
}

export async function fetchCsrfContext(input: {
  server: Parameters<typeof request>[0];
  authCookieService: AuthCookieService;
  sessionCookie?: string;
}): Promise<{ csrfToken: string; csrfCookie: string }> {
  const csrfRequest = request(input.server)
    .get('/auth/csrf')
    .set('Origin', HTTP_TEST_ORIGIN);

  if (input.sessionCookie) {
    csrfRequest.set('Cookie', input.sessionCookie);
  }

  const response = await csrfRequest.expect(200);

  return {
    csrfToken: (response.body as { csrfToken: string }).csrfToken,
    csrfCookie: extractCookiePair(
      response.headers['set-cookie'],
      input.authCookieService.getCsrfCookieName(),
    ),
  };
}

export async function grantPermission(input: {
  prisma: PrismaService;
  organizationId: string;
  roleId: string;
  permissionCode: string;
}): Promise<void> {
  const permission = await input.prisma.permission.findUniqueOrThrow({
    where: { code: input.permissionCode },
    select: { id: true },
  });
  await input.prisma.rolePermission.create({
    data: {
      organizationId: input.organizationId,
      roleId: input.roleId,
      permissionId: permission.id,
    },
  });
}

export async function cleanupCoreHttpTestData(
  prisma: PrismaService,
  cleanup: CoreHttpTestCleanup,
): Promise<void> {
  await deleteByIds(cleanup.sessionIds, (ids) =>
    prisma.userSession.deleteMany({ where: { id: { in: ids } } }),
  );
  await deleteByIds(cleanup.employeeIds, (ids) =>
    prisma.employeeRole.deleteMany({ where: { employeeId: { in: ids } } }),
  );
  await deleteByIds(cleanup.roleIds, (ids) =>
    prisma.rolePermission.deleteMany({ where: { roleId: { in: ids } } }),
  );
  await deleteByIds(cleanup.roleIds, (ids) =>
    prisma.role.deleteMany({ where: { id: { in: ids } } }),
  );
  await deleteByIds(cleanup.employeeIds, (ids) =>
    prisma.employeeFacility.deleteMany({ where: { employeeId: { in: ids } } }),
  );
  await deleteByIds(cleanup.employeeIds, (ids) =>
    prisma.employee.deleteMany({ where: { id: { in: ids } } }),
  );
  await deleteByIds(cleanup.facilityIds ?? [], (ids) =>
    prisma.facility.deleteMany({ where: { id: { in: ids } } }),
  );
  await deleteByIds(cleanup.customerIds ?? [], (ids) =>
    prisma.customer.deleteMany({ where: { id: { in: ids } } }),
  );
  await deleteByIds(cleanup.userIds, (ids) =>
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  );

  if (cleanup.organizationIds.length > 0) {
    await deleteAuditArtifactsForOrganizations(prisma, cleanup.organizationIds);
    await prisma.organizationSettings.deleteMany({
      where: { organizationId: { in: cleanup.organizationIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: cleanup.organizationIds } },
    });
  }
}

async function deleteByIds(
  ids: string[],
  operation: (ids: string[]) => Promise<unknown>,
): Promise<void> {
  if (ids.length > 0) {
    await operation(ids);
  }
}

function extractCookiePair(
  cookies: string | string[] | undefined,
  cookieName: string,
): string {
  const normalizedCookies = Array.isArray(cookies)
    ? cookies
    : typeof cookies === 'string'
      ? [cookies]
      : [];
  const cookie = normalizedCookies.find((entry) =>
    entry.startsWith(`${cookieName}=`),
  );

  if (!cookie) {
    throw new Error(`Missing cookie ${cookieName}`);
  }

  return cookie.split(';')[0];
}
