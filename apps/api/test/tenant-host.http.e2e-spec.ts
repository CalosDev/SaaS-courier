import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
const BASE_DOMAIN = 'platform.test';
const PASSWORD = 'Correct Horse Battery Staple 123!';

type CookieHeader = string | string[] | undefined;

function cookie(cookies: CookieHeader, name: string): string {
  const values = Array.isArray(cookies)
    ? cookies
    : typeof cookies === 'string'
      ? [cookies]
      : [];
  const value = values.find((candidate) => candidate.startsWith(`${name}=`));
  if (!value) throw new Error(`Missing cookie ${name}`);
  return value.split(';')[0];
}

describe('tenant host HTTP isolation', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prisma: PrismaService | null = null;
  const previousEnvironment: Record<string, string | undefined> = {};
  const cleanup = {
    employeeFacilityIds: [] as string[],
    employeeRoleIds: [] as string[],
    employeeIds: [] as string[],
    facilityIds: [] as string[],
    organizationIds: [] as string[],
    roleIds: [] as string[],
    userIds: [] as string[],
  };

  beforeAll(() => {
    for (const key of [
      'DATABASE_URL',
      'NODE_ENV',
      'APP_ENV',
      'COOKIE_SECURE',
      'CORS_ORIGINS',
      'APP_BASE_DOMAIN',
      'TENANT_SUBDOMAINS_ENABLED',
      'TENANT_ALLOW_BARE_LOCALHOST',
      'TRUST_PROXY',
    ]) {
      previousEnvironment[key] = process.env[key];
    }

    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = 'http://central.platform.test';
    process.env.APP_BASE_DOMAIN = BASE_DOMAIN;
    process.env.TENANT_SUBDOMAINS_ENABLED = 'true';
    process.env.TENANT_ALLOW_BARE_LOCALHOST = 'false';
    process.env.TRUST_PROXY = 'false';
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('binds login and existing sessions to the tenant host', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: (key: string) => process.env[key],
        })
        .compile();
      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app);
      await app.init();

      const database = moduleRef.get(PrismaService);
      prisma = database;
      expect(
        moduleRef.get(ConfigService).get('TENANT_SUBDOMAINS_ENABLED'),
      ).toBe('true');
      const passwordHasher = moduleRef.get(PasswordHasher);
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8).toUpperCase();
      const passwordHash = await passwordHasher.hash(PASSWORD);

      const organizationA = await database.organization.create({
        data: {
          legalName: `Tenant A ${suffix}`,
          commercialName: `Tenant A ${suffix}`,
          slug: `tenant-a-${suffix}`,
          status: 'ACTIVE',
        },
      });
      const organizationB = await database.organization.create({
        data: {
          legalName: `Tenant B ${suffix}`,
          commercialName: `Tenant B ${suffix}`,
          slug: `tenant-b-${suffix}`,
          status: 'ACTIVE',
        },
      });
      const suspendedOrganization = await database.organization.create({
        data: {
          legalName: `Suspended ${suffix}`,
          commercialName: `Suspended ${suffix}`,
          slug: `suspended-${suffix}`,
          status: 'SUSPENDED',
        },
      });
      cleanup.organizationIds.push(
        organizationA.id,
        organizationB.id,
        suspendedOrganization.id,
      );

      const user = await database.user.create({
        data: {
          email: `tenant-host.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const employeeA = await createEmployee(
        database,
        organizationA.id,
        user.id,
        `A-${shortCode}`,
      );
      const employeeB = await createEmployee(
        database,
        organizationB.id,
        user.id,
        `B-${shortCode}`,
      );
      cleanup.employeeIds.push(employeeA.id, employeeB.id);

      const facilityA = await createFacility(
        database,
        organizationA.id,
        `A-${shortCode}`,
      );
      const facilityB = await createFacility(
        database,
        organizationB.id,
        `B-${shortCode}`,
      );
      cleanup.facilityIds.push(facilityA.id, facilityB.id);
      cleanup.employeeFacilityIds.push(
        (
          await database.employeeFacility.create({
            data: {
              organizationId: organizationA.id,
              employeeId: employeeA.id,
              facilityId: facilityA.id,
              isPrimary: true,
            },
          })
        ).id,
        (
          await database.employeeFacility.create({
            data: {
              organizationId: organizationB.id,
              employeeId: employeeB.id,
              facilityId: facilityB.id,
              isPrimary: true,
            },
          })
        ).id,
      );

      const role = await database.role.create({
        data: {
          organizationId: organizationA.id,
          code: `HOST_${shortCode}`,
          name: 'Tenant host test role',
        },
      });
      cleanup.roleIds.push(role.id);
      cleanup.employeeRoleIds.push(
        (
          await database.employeeRole.create({
            data: {
              organizationId: organizationA.id,
              employeeId: employeeA.id,
              roleId: role.id,
            },
          })
        ).id,
      );
      for (const code of [
        'organizations.read',
        'customers.read',
        'packages.read',
        'billing.read',
        'customs_manifests.read',
        'reports.read',
      ]) {
        const permission = await database.permission.upsert({
          where: { code },
          create: { code, name: code, isActive: true },
          update: { isActive: true },
        });
        await database.rolePermission.create({
          data: {
            organizationId: organizationA.id,
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }

      const hostA = `${organizationA.slug}.${BASE_DOMAIN}`;
      const hostB = `${organizationB.slug}.${BASE_DOMAIN}`;
      const originA = `http://${hostA}`;
      const csrfResponse = await request(server)
        .get('/auth/csrf')
        .set('Host', hostA)
        .set('Origin', originA)
        .expect(200);
      const csrfCookie = cookie(
        csrfResponse.headers['set-cookie'],
        'courier_csrf',
      );
      const csrfToken = (csrfResponse.body as { csrfToken: string }).csrfToken;

      const loginResponse = await request(server)
        .post('/auth/login')
        .set('Host', `${hostA.toUpperCase()}:443`)
        .set('Origin', originA)
        .set('X-Forwarded-Host', hostB)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfCookie)
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      expect(loginResponse.body).toMatchObject({
        status: 'authenticated',
        session: { organizationId: organizationA.id },
      });
      const sessionCookie = cookie(
        loginResponse.headers['set-cookie'],
        'courier_session',
      );

      for (const path of [
        '/auth/session',
        '/organizations/current',
        '/customers',
        '/packages',
        '/invoices',
        '/customs-manifests',
        '/reports/dashboard-metrics',
      ]) {
        await request(server)
          .get(path)
          .set('Host', hostA)
          .set('Cookie', sessionCookie)
          .expect(200);
      }

      await request(server)
        .get('/auth/session')
        .set('Host', hostB)
        .set('Cookie', sessionCookie)
        .expect(403);
      app.set('trust proxy', ['loopback']);
      await request(server)
        .get('/auth/session')
        .set('Host', hostA)
        .set('X-Forwarded-Host', hostB)
        .set('Cookie', sessionCookie)
        .expect(403);
      app.set('trust proxy', false);
      await request(server)
        .get('/auth/session')
        .set('Host', `missing-${suffix}.${BASE_DOMAIN}`)
        .set('Cookie', sessionCookie)
        .expect(404);
      await request(server)
        .post('/auth/select-organization')
        .set('Host', hostA)
        .set('Origin', originA)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfCookie)
        .send({ organizationId: organizationB.id })
        .expect(403);
      await request(server)
        .post('/auth/login')
        .set('Host', `${suspendedOrganization.slug}.${BASE_DOMAIN}`)
        .set('Origin', `http://${suspendedOrganization.slug}.${BASE_DOMAIN}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfCookie)
        .send({ email: user.email, password: PASSWORD })
        .expect(404);

      await request(server)
        .get('/health')
        .set('Host', 'malformed.invalid.example')
        .expect(200);
    } finally {
      await cleanupDatabase(prisma, cleanup);
      if (app) await app.close();
      if (moduleRef) await moduleRef.close();
    }
  }, 120_000);
});

async function createEmployee(
  prisma: PrismaService,
  organizationId: string,
  userId: string,
  employeeCode: string,
) {
  return prisma.employee.create({
    data: {
      organizationId,
      userId,
      employeeCode,
      firstName: 'Tenant',
      lastName: 'Operator',
      status: 'ACTIVE',
    },
  });
}

async function createFacility(
  prisma: PrismaService,
  organizationId: string,
  code: string,
) {
  return prisma.facility.create({
    data: {
      organizationId,
      code,
      name: code,
      type: 'BRANCH',
      isActive: true,
    },
  });
}

async function cleanupDatabase(
  prisma: PrismaService | null,
  cleanup: {
    employeeFacilityIds: string[];
    employeeRoleIds: string[];
    employeeIds: string[];
    facilityIds: string[];
    organizationIds: string[];
    roleIds: string[];
    userIds: string[];
  },
) {
  if (!prisma) return;
  await prisma.userSession.deleteMany({
    where: { employeeId: { in: cleanup.employeeIds } },
  });
  await prisma.loginChallenge.deleteMany({
    where: { userId: { in: cleanup.userIds } },
  });
  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: cleanup.roleIds } },
  });
  await prisma.employeeRole.deleteMany({
    where: { id: { in: cleanup.employeeRoleIds } },
  });
  await prisma.employeeFacility.deleteMany({
    where: { id: { in: cleanup.employeeFacilityIds } },
  });
  await prisma.role.deleteMany({ where: { id: { in: cleanup.roleIds } } });
  await prisma.employee.deleteMany({
    where: { id: { in: cleanup.employeeIds } },
  });
  await prisma.facility.deleteMany({
    where: { id: { in: cleanup.facilityIds } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: cleanup.organizationIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
}
