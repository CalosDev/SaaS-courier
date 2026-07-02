import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { CustomerIdentityConflictError } from '../src/customers/customer.errors';
import { CustomerAddressesRepository } from '../src/customers/customer-addresses.repository';
import { CustomerCustomsProfilesRepository } from '../src/customers/customer-customs-profiles.repository';
import { CustomersRepository } from '../src/customers/customers.repository';
import { CustomersService } from '../src/customers/customers.service';
import { PrismaCustomerAddressesRepository } from '../src/customers/prisma-customer-addresses.repository';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Customers repository integration', () => {
  it('enforces tenant isolation, supports manual internal codes, keeps one primary address per type, and isolates customs identities per tenant', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const concurrentClients: PrismaClient[] = [];
    const cleanup = {
      organizationIds: [] as string[],
      customerIds: [] as string[],
      addressIds: [] as string[],
      customsProfileIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const customersRepository =
        moduleRef.get<CustomersRepository>(CustomersRepository);
      const customerAddressesRepository =
        moduleRef.get<CustomerAddressesRepository>(CustomerAddressesRepository);
      const customerCustomsProfilesRepository =
        moduleRef.get<CustomerCustomsProfilesRepository>(
          CustomerCustomsProfilesRepository,
        );
      const customersService = moduleRef.get(CustomersService);

      const suffix = randomUUID();
      const organizationOne = await prisma.organization.create({
        data: {
          legalName: `Customers Org One ${suffix}`,
          commercialName: `Customers Org One ${suffix}`,
          slug: `customers-one-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationOne.id);
      await prisma.organizationSettings.create({
        data: {
          organizationId: organizationOne.id,
        },
      });

      const organizationTwo = await prisma.organization.create({
        data: {
          legalName: `Customers Org Two ${suffix}`,
          commercialName: `Customers Org Two ${suffix}`,
          slug: `customers-two-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationTwo.id);
      await prisma.organizationSettings.create({
        data: {
          organizationId: organizationTwo.id,
        },
      });

      const manualCustomerOne = await customersRepository.create({
        organizationId: organizationOne.id,
        customerCode: 'CF-10542',
        type: 'BUSINESS',
        firstName: null,
        lastName: null,
        businessName: 'Courier One Import',
        email: null,
        phone: null,
        mobilePhone: null,
        status: 'PENDING',
        notes: null,
      });
      cleanup.customerIds.push(manualCustomerOne.id);

      const manualCustomerTwo = await customersRepository.create({
        organizationId: organizationTwo.id,
        customerCode: 'CF-10542',
        type: 'BUSINESS',
        firstName: null,
        lastName: null,
        businessName: 'Courier Two Import',
        email: null,
        phone: null,
        mobilePhone: null,
        status: 'PENDING',
        notes: null,
      });
      cleanup.customerIds.push(manualCustomerTwo.id);

      await expect(
        customersRepository.create({
          organizationId: organizationOne.id,
          customerCode: 'CF-10542',
          type: 'BUSINESS',
          firstName: null,
          lastName: null,
          businessName: 'Duplicate Internal Code',
          email: null,
          phone: null,
          mobilePhone: null,
          status: 'PENDING',
          notes: null,
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
      });

      const generatedCustomer = await customersService.create(
        organizationOne.id,
        {
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@courier.test',
        },
      );
      cleanup.customerIds.push(generatedCustomer.id);

      expect(generatedCustomer.customerCode).toMatch(/^C[A-HJ-NP-Z2-9]{8}$/);

      expect(
        await customersRepository.findById(
          organizationOne.id,
          manualCustomerOne.id,
        ),
      ).toMatchObject({
        id: manualCustomerOne.id,
      });
      expect(
        await customersRepository.findById(
          organizationOne.id,
          manualCustomerTwo.id,
        ),
      ).toBeNull();

      const homeAddress = await customerAddressesRepository.create({
        organizationId: organizationOne.id,
        customerId: generatedCustomer.id,
        type: 'HOME',
        label: 'Casa principal',
        recipientName: 'Ada Lovelace',
        phone: null,
        addressLine1: 'Calle 1',
        addressLine2: null,
        city: 'Santo Domingo',
        province: 'Distrito Nacional',
        postalCode: null,
        countryCode: 'DO',
        isPrimary: true,
        isActive: true,
      });
      cleanup.addressIds.push(homeAddress.id);

      const workAddress = await customerAddressesRepository.create({
        organizationId: organizationOne.id,
        customerId: generatedCustomer.id,
        type: 'HOME',
        label: 'Casa alterna',
        recipientName: 'Ada Lovelace',
        phone: null,
        addressLine1: 'Calle 2',
        addressLine2: null,
        city: 'Santo Domingo',
        province: 'Distrito Nacional',
        postalCode: null,
        countryCode: 'DO',
        isPrimary: false,
        isActive: true,
      });
      cleanup.addressIds.push(workAddress.id);

      const concurrentPrismaOne = new PrismaClient({
        adapter: new PrismaPg(LOCAL_DATABASE_URL),
      });
      const concurrentPrismaTwo = new PrismaClient({
        adapter: new PrismaPg(LOCAL_DATABASE_URL),
      });
      concurrentClients.push(concurrentPrismaOne, concurrentPrismaTwo);
      await Promise.all([
        concurrentPrismaOne.$connect(),
        concurrentPrismaTwo.$connect(),
      ]);
      const concurrentRepositoryOne = new PrismaCustomerAddressesRepository(
        concurrentPrismaOne as unknown as PrismaService,
      );
      const concurrentRepositoryTwo = new PrismaCustomerAddressesRepository(
        concurrentPrismaTwo as unknown as PrismaService,
      );

      const concurrentPrimaryResults = await Promise.allSettled([
        concurrentRepositoryOne.update({
          organizationId: organizationOne.id,
          customerId: generatedCustomer.id,
          addressId: homeAddress.id,
          isPrimary: true,
        }),
        concurrentRepositoryTwo.update({
          organizationId: organizationOne.id,
          customerId: generatedCustomer.id,
          addressId: workAddress.id,
          isPrimary: true,
        }),
      ]);

      expect(
        concurrentPrimaryResults.every(
          (result) => result.status === 'fulfilled',
        ),
      ).toBe(true);

      const homeAddresses = await customerAddressesRepository.listByCustomerId(
        organizationOne.id,
        generatedCustomer.id,
      );
      const primaryHomeAddresses = homeAddresses.filter(
        (address) => address.type === 'HOME' && address.isPrimary,
      );

      expect(primaryHomeAddresses).toHaveLength(1);
      expect([homeAddress.id, workAddress.id]).toContain(
        primaryHomeAddresses[0]?.id,
      );

      const customsProfile =
        await customerCustomsProfilesRepository.upsertIdentity({
          organizationId: organizationOne.id,
          customerId: generatedCustomer.id,
          documentType: 'CEDULA',
          documentNumber: '00112345678',
          ruaStatus: 'UNKNOWN',
          verificationSource: null,
          lastCheckedAt: null,
          verifiedAt: null,
          externalReference: null,
          notes: null,
        });
      cleanup.customsProfileIds.push(customsProfile.id);

      const otherTenantCustomer = await customersRepository.create({
        organizationId: organizationTwo.id,
        customerCode: 'SDQ20483',
        type: 'INDIVIDUAL',
        firstName: 'Grace',
        lastName: 'Hopper',
        businessName: null,
        email: null,
        phone: null,
        mobilePhone: null,
        status: 'PENDING',
        notes: null,
      });
      cleanup.customerIds.push(otherTenantCustomer.id);

      const otherTenantProfile =
        await customerCustomsProfilesRepository.upsertIdentity({
          organizationId: organizationTwo.id,
          customerId: otherTenantCustomer.id,
          documentType: 'CEDULA',
          documentNumber: '00112345678',
          ruaStatus: 'UNKNOWN',
          verificationSource: null,
          lastCheckedAt: null,
          verifiedAt: null,
          externalReference: null,
          notes: null,
        });
      cleanup.customsProfileIds.push(otherTenantProfile.id);

      const sameTenantSecondCustomer = await customersRepository.create({
        organizationId: organizationOne.id,
        customerCode: '10004582',
        type: 'INDIVIDUAL',
        firstName: 'Katherine',
        lastName: 'Johnson',
        businessName: null,
        email: null,
        phone: null,
        mobilePhone: null,
        status: 'PENDING',
        notes: null,
      });
      cleanup.customerIds.push(sameTenantSecondCustomer.id);

      await expect(
        customerCustomsProfilesRepository.upsertIdentity({
          organizationId: organizationOne.id,
          customerId: sameTenantSecondCustomer.id,
          documentType: 'CEDULA',
          documentNumber: '00112345678',
          ruaStatus: 'UNKNOWN',
          verificationSource: null,
          lastCheckedAt: null,
          verifiedAt: null,
          externalReference: null,
          notes: null,
        }),
      ).rejects.toBeInstanceOf(CustomerIdentityConflictError);

      const checkedAt = new Date('2026-07-01T12:00:00.000Z');
      const registeredProfile =
        await customerCustomsProfilesRepository.updateVerification({
          organizationId: organizationOne.id,
          customerId: generatedCustomer.id,
          ruaStatus: 'REGISTERED',
          verificationSource: 'MANUAL',
          lastCheckedAt: checkedAt,
          verifiedAt: checkedAt,
          externalReference: 'DGA-123',
          notes: 'Verified',
        });

      expect(registeredProfile).toMatchObject({
        ruaStatus: 'REGISTERED',
        verificationSource: 'MANUAL',
      });
      expect(registeredProfile?.verifiedAt?.toISOString()).toBe(
        checkedAt.toISOString(),
      );

      const resetProfile =
        await customerCustomsProfilesRepository.upsertIdentity({
          organizationId: organizationOne.id,
          customerId: generatedCustomer.id,
          documentType: 'PASSPORT',
          documentNumber: 'AB-12345',
          ruaStatus: 'UNKNOWN',
          verificationSource: null,
          lastCheckedAt: null,
          verifiedAt: null,
          externalReference: null,
          notes: 'Updated identity',
        });

      expect(resetProfile).toMatchObject({
        documentType: 'PASSPORT',
        documentNumber: 'AB-12345',
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
        externalReference: null,
      });
    } finally {
      for (const client of concurrentClients) {
        await client.$disconnect();
      }

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
        if (cleanup.addressIds.length > 0) {
          await prismaService.customerAddress.deleteMany({
            where: {
              id: {
                in: cleanup.addressIds,
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
