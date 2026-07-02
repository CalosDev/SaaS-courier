import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { CustomersService } from '../src/customers/customers.service';
import { OrganizationSettingsService } from '../src/organization-settings/organization-settings.service';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Organization settings integration', () => {
  it('backfills defaults for new organizations, updates settings, exposes capabilities, and generates sequential customer codes safely', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      customerIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const organizationsService =
        moduleRef.get<OrganizationsService>(OrganizationsService);
      const organizationSettingsService = moduleRef.get(
        OrganizationSettingsService,
      );
      const customersService = moduleRef.get(CustomersService);
      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;

      const suffix = randomUUID();
      const organization = await organizationsService.create({
        legalName: `Settings Legal ${suffix}`,
        commercialName: `Settings Commercial ${suffix}`,
        slug: `settings-${suffix}`,
        email: 'ops@courier.test',
        phone: '809-555-0101',
      });
      cleanup.organizationIds.push(organization.id);

      const current = await organizationSettingsService.getCurrent(
        organization.id,
      );
      expect(current.settings).toMatchObject({
        locale: 'es-DO',
        dateFormat: 'DMY',
        weightUnit: 'LB',
        dimensionUnit: 'IN',
        customerCodeStrategy: 'AUTO_RANDOM',
        customerCodePrefix: 'C',
        customerCodeRandomLength: 8,
        customerCodeSequencePadding: 6,
        nextCustomerSequence: 1,
      });

      await organizationSettingsService.updateCurrent(organization.id, {
        locale: 'en-US',
        dateFormat: 'MDY',
        weightUnit: 'KG',
        dimensionUnit: 'CM',
        timezone: 'America/New_York',
        currencyCode: 'USD',
        countryCode: 'US',
        customerCodeStrategy: 'AUTO_SEQUENTIAL',
        customerCodePrefix: 'CF-',
        customerCodeSequencePadding: 6,
      });

      const [firstCustomer, secondCustomer] = await Promise.all([
        customersService.create(organization.id, {
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }),
        customersService.create(organization.id, {
          type: 'BUSINESS',
          businessName: 'ACME Imports',
        }),
      ]);
      cleanup.customerIds.push(firstCustomer.id, secondCustomer.id);

      expect(firstCustomer.customerCode).toMatch(/^CF-\d{6}$/);
      expect(secondCustomer.customerCode).toMatch(/^CF-\d{6}$/);
      expect(firstCustomer.customerCode).not.toBe(secondCustomer.customerCode);

      const capabilities = await organizationSettingsService.getCapabilities(
        organization.id,
      );
      expect(capabilities).toEqual({
        planCode: 'PILOT',
        modules: [
          'organizations',
          'facilities',
          'employees',
          'roles',
          'customers',
          'onboarding',
          'customer_imports',
        ],
        limits: {
          maxUsers: 5,
          maxFacilities: 2,
        },
        usage: {
          users: 0,
          facilities: 0,
          customers: 2,
        },
      });
    } finally {
      if (prismaService) {
        if (cleanup.customerIds.length > 0) {
          await prismaService.customer.deleteMany({
            where: {
              id: {
                in: cleanup.customerIds,
              },
            },
          });
        }
        if (cleanup.organizationIds.length > 0) {
          await prismaService.organizationSettings.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.organization.deleteMany({
            where: {
              id: {
                in: cleanup.organizationIds,
              },
            },
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
  }, 60000);
});
