import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Public tracking HTTP', () => {
  it('resolves supported references without PII and enforces tenant, auth, no-store and throttling', async () => {
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
      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app as NestExpressApplication);
      await app.init();
      const db = moduleRef.get(PrismaService);
      prisma = db;
      const first = await seedTenant(db, 'alpha');
      const second = await seedTenant(db, 'beta');
      organizationIds.push(first.organizationId, second.organizationId);
      userIds.push(first.userId, second.userId);

      for (const reference of [
        first.internalTracking,
        first.externalTracking,
        first.prealertCode,
      ]) {
        const response = await request(app.getHttpServer())
          .get(`/public/organizations/${first.slug}/tracking/${reference}`)
          .expect(200)
          .expect('Cache-Control', 'no-store');
        expect(response.body).toMatchObject({
          organization: { slug: first.slug, name: 'Tracking alpha' },
          internalTrackingNumber: first.internalTracking,
          status: 'ARRIVED_AT_DESTINATION',
        });
        const serialized = JSON.stringify(response.body).toLowerCase();
        expect(serialized).not.toContain('customer');
        expect(serialized).not.toContain('employee');
        expect(serialized).not.toContain('private@example.test');
        expect(serialized).not.toContain('sensitive internal note');
      }

      await request(app.getHttpServer())
        .get(
          `/public/organizations/${second.slug}/tracking/${first.internalTracking}`,
        )
        .expect(404);
      await request(app.getHttpServer())
        .get(`/tracking/resolve/${first.internalTracking}`)
        .expect(401);

      const throttled = await Promise.all(
        Array.from({ length: 22 }, () =>
          request(app!.getHttpServer()).get(
            `/public/organizations/${first.slug}/tracking/NOTFOUND`,
          ),
        ),
      );
      expect(throttled.some((response) => response.status === 429)).toBe(true);
    } finally {
      if (prisma) {
        await prisma.packageTrackingEvent.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.package.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.prealert.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prisma.customer.deleteMany({
          where: { organizationId: { in: organizationIds } },
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
  const compact = suffix.replaceAll('-', '').toUpperCase();
  const slug = `tracking-${label}-${suffix}`;
  const organization = await prisma.organization.create({
    data: {
      legalName: `Tracking ${label}`,
      commercialName: `Tracking ${label}`,
      slug,
      status: 'ACTIVE',
    },
  });
  await prisma.organizationSettings.create({
    data: { organizationId: organization.id },
  });
  const user = await prisma.user.create({
    data: {
      email: `tracking.${label}.${suffix}@courier.test`,
      status: 'ACTIVE',
    },
  });
  const employee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      firstName: 'Private',
      lastName: 'Employee',
      status: 'ACTIVE',
    },
  });
  const customer = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      customerCode: `TR${compact.slice(0, 8)}`,
      type: 'INDIVIDUAL',
      firstName: 'Private',
      lastName: 'Customer',
      email: 'private@example.test',
      status: 'ACTIVE',
    },
  });
  const externalTracking = `EXT${compact.slice(0, 12)}`;
  const prealert = await prisma.prealert.create({
    data: {
      organizationId: organization.id,
      customerId: customer.id,
      createdByEmployeeId: employee.id,
      prealertCode: 'PAABCDEFG234',
      externalTrackingNumber: externalTracking,
      externalTrackingNumberNormalized: externalTracking,
      storeName: 'Store',
      description: 'Private purchase',
      quantity: 1,
      declaredValue: 10,
      currencyCode: 'USD',
      status: 'MATCHED',
    },
  });
  const internalTracking =
    label === 'alpha' ? 'PKABCDEFGH2345' : 'PKHGFEDCBA5432';
  const pkg = await prisma.package.create({
    data: {
      organizationId: organization.id,
      customerId: customer.id,
      prealertId: prealert.id,
      registeredByEmployeeId: employee.id,
      internalTrackingNumber: internalTracking,
      externalTrackingNumber: externalTracking,
      externalTrackingNumberNormalized: externalTracking,
      status: 'ARRIVED_AT_DESTINATION',
      notes: 'Sensitive internal note',
    },
  });
  await prisma.packageTrackingEvent.create({
    data: {
      organizationId: organization.id,
      packageId: pkg.id,
      eventType: 'ARRIVED_AT_DESTINATION',
      location: 'Sucursal Central',
      description: 'Sensitive internal note',
      createdById: employee.id,
    },
  });
  return {
    organizationId: organization.id,
    userId: user.id,
    slug,
    internalTracking,
    externalTracking,
    prealertCode: prealert.prealertCode,
  };
}
