import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { CustomerImportsService } from '../src/customer-imports/customer-imports.service';
import { OrganizationSettingsService } from '../src/organization-settings/organization-settings.service';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Customer imports integration', () => {
  it('stages, validates, commits atomically, preserves requested codes, generates missing codes, and keeps commit idempotent', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      customerIds: [] as string[],
      customsProfileIds: [] as string[],
      importJobIds: [] as string[],
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
      const customerImportsService = moduleRef.get(CustomerImportsService);
      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;

      const suffix = randomUUID();
      const organization = await organizationsService.create({
        legalName: `Imports Legal ${suffix}`,
        commercialName: `Imports Commercial ${suffix}`,
        slug: `imports-${suffix}`,
        email: 'ops@courier.test',
        phone: '809-555-0111',
      });
      cleanup.organizationIds.push(organization.id);

      await organizationSettingsService.updateCurrent(organization.id, {
        customerCodeStrategy: 'AUTO_SEQUENTIAL',
        customerCodePrefix: 'CF-',
        customerCodeSequencePadding: 6,
      });

      const user = await prisma.user.create({
        data: {
          email: `imports-owner.${suffix}@courier.test`,
          status: 'ACTIVE' as const,
        },
      });
      cleanup.userIds.push(user.id);

      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          firstName: 'Import',
          lastName: 'Owner',
          status: 'ACTIVE' as const,
        },
      });
      cleanup.employeeIds.push(employee.id);

      const job = await customerImportsService.create(
        organization.id,
        employee.id,
        {
          name: 'Legacy import',
          preserveCustomerCodes: true,
          rows: [
            {
              type: 'BUSINESS',
              businessName: 'ACME Legacy',
              customerCode: 'MIA-CF-882',
            },
            {
              type: 'INDIVIDUAL',
              firstName: 'Ada',
              lastName: 'Lovelace',
              customsProfile: {
                documentType: 'CEDULA',
                documentNumber: '001-1234567-8',
              },
            },
          ],
        },
      );
      cleanup.importJobIds.push(job.id);

      const validated = await customerImportsService.validate(
        organization.id,
        job.id,
      );

      expect(validated.status).toBe('VALIDATED');
      expect(validated.validRows).toBe(2);
      expect(validated.invalidRows).toBe(0);
      expect(
        await prisma.customer.count({
          where: { organizationId: organization.id },
        }),
      ).toBe(0);

      const committed = await customerImportsService.commit(
        organization.id,
        job.id,
      );
      expect(committed.status).toBe('COMPLETED');

      const importedCustomers = await prisma.customer.findMany({
        where: {
          organizationId: organization.id,
        },
        orderBy: [{ customerCode: 'asc' }],
      });
      cleanup.customerIds.push(
        ...importedCustomers.map((customer) => customer.id),
      );

      expect(importedCustomers).toHaveLength(2);
      expect(
        importedCustomers.map((customer) => customer.customerCode),
      ).toEqual(expect.arrayContaining(['MIA-CF-882']));
      expect(
        importedCustomers.some((customer) =>
          /^CF-\d{6}$/.test(customer.customerCode),
        ),
      ).toBe(true);

      const customsProfiles = await prisma.customerCustomsProfile.findMany({
        where: {
          organizationId: organization.id,
        },
      });
      cleanup.customsProfileIds.push(
        ...customsProfiles.map((profile) => profile.id),
      );
      expect(customsProfiles).toHaveLength(1);
      expect(customsProfiles[0]?.ruaStatus).toBe('UNKNOWN');

      const committedAgain = await customerImportsService.commit(
        organization.id,
        job.id,
      );
      expect(committedAgain.status).toBe('COMPLETED');
      expect(
        await prisma.customer.count({
          where: {
            organizationId: organization.id,
          },
        }),
      ).toBe(2);
    } finally {
      if (prismaService) {
        if (cleanup.customsProfileIds.length > 0) {
          await prismaService.customerCustomsProfile.deleteMany({
            where: {
              id: {
                in: cleanup.customsProfileIds,
              },
            },
          });
        }
        if (cleanup.importJobIds.length > 0) {
          await prismaService.customerImportRow.deleteMany({
            where: {
              importJobId: {
                in: cleanup.importJobIds,
              },
            },
          });
          await prismaService.customerImportJob.deleteMany({
            where: {
              id: {
                in: cleanup.importJobIds,
              },
            },
          });
        }
        if (cleanup.customerIds.length > 0) {
          await prismaService.customer.deleteMany({
            where: {
              id: {
                in: cleanup.customerIds,
              },
            },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employee.deleteMany({
            where: {
              id: {
                in: cleanup.employeeIds,
              },
            },
          });
        }
        if (cleanup.userIds.length > 0) {
          await prismaService.user.deleteMany({
            where: {
              id: {
                in: cleanup.userIds,
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
