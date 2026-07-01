import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import {
  FacilityCodeConflictError,
  FacilityLimitReachedError,
  FacilityNotFoundError,
} from '../src/facilities/facility.errors';
import { FacilitiesRepository } from '../src/facilities/facilities.repository';
import type {
  CreateFacilityRecord,
  FacilityRecord,
} from '../src/facilities/facility.types';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaFacilitiesRepository } from '../src/facilities/prisma-facilities.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Facilities repository integration', () => {
  it('enforces tenant isolation, pagination, code conflicts, and maxFacilities under concurrency', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const concurrentClients: PrismaClient[] = [];
    const cleanup = {
      organizationIds: [] as string[],
      facilityIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get<PrismaService>(PrismaService);
      prismaService = prisma;
      const facilitiesRepository =
        moduleRef.get<FacilitiesRepository>(FacilitiesRepository);
      const suffix = randomUUID();
      const organizationOne = await prisma.organization.create({
        data: {
          legalName: `Facilities Org One ${suffix}`,
          commercialName: `Facilities Org One ${suffix}`,
          slug: `facilities-one-${suffix}`,
          maxFacilities: 5,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationOne.id);

      const organizationTwo = await prisma.organization.create({
        data: {
          legalName: `Facilities Org Two ${suffix}`,
          commercialName: `Facilities Org Two ${suffix}`,
          slug: `facilities-two-${suffix}`,
          maxFacilities: 5,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationTwo.id);

      const organizationLimited = await prisma.organization.create({
        data: {
          legalName: `Facilities Limited ${suffix}`,
          commercialName: `Facilities Limited ${suffix}`,
          slug: `facilities-limited-${suffix}`,
          maxFacilities: 1,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationLimited.id);

      const facilityOrgOne = await facilitiesRepository.create({
        organizationId: organizationOne.id,
        code: 'SDQ',
        name: 'Santo Domingo',
        type: 'BRANCH',
        ownershipType: 'OWNED',
        countryCode: 'DO',
        province: null,
        city: null,
        addressLine1: null,
        addressLine2: null,
        phone: null,
        email: null,
        isCustomerFacing: true,
        isPackageOrigin: false,
        isDistributionCenter: false,
        isActive: true,
      });
      cleanup.facilityIds.push(facilityOrgOne.id);

      const facilityOrgTwo = await facilitiesRepository.create({
        organizationId: organizationTwo.id,
        code: 'SDQ',
        name: 'Santiago',
        type: 'BRANCH',
        ownershipType: 'OWNED',
        countryCode: 'DO',
        province: null,
        city: null,
        addressLine1: null,
        addressLine2: null,
        phone: null,
        email: null,
        isCustomerFacing: true,
        isPackageOrigin: false,
        isDistributionCenter: false,
        isActive: true,
      });
      cleanup.facilityIds.push(facilityOrgTwo.id);

      await expect(
        facilitiesRepository.create({
          organizationId: organizationOne.id,
          code: 'SDQ',
          name: 'Duplicate',
          type: 'BRANCH',
          ownershipType: 'OWNED',
          countryCode: 'DO',
          province: null,
          city: null,
          addressLine1: null,
          addressLine2: null,
          phone: null,
          email: null,
          isCustomerFacing: true,
          isPackageOrigin: false,
          isDistributionCenter: false,
          isActive: true,
        }),
      ).rejects.toBeInstanceOf(FacilityCodeConflictError);

      expect(
        await facilitiesRepository.findById(
          organizationOne.id,
          facilityOrgOne.id,
        ),
      ).toMatchObject({
        id: facilityOrgOne.id,
      });
      expect(
        await facilitiesRepository.findById(
          organizationOne.id,
          facilityOrgTwo.id,
        ),
      ).toBeNull();

      await expect(
        facilitiesRepository.update({
          organizationId: organizationOne.id,
          facilityId: facilityOrgTwo.id,
          name: 'Should Not Update',
        }),
      ).rejects.toBeInstanceOf(FacilityNotFoundError);

      const inactiveFacility = await facilitiesRepository.create({
        organizationId: organizationOne.id,
        code: 'POP',
        name: 'Puerto Plata',
        type: 'AGENCY',
        ownershipType: 'AGENCY',
        countryCode: 'DO',
        province: null,
        city: null,
        addressLine1: null,
        addressLine2: null,
        phone: null,
        email: null,
        isCustomerFacing: true,
        isPackageOrigin: false,
        isDistributionCenter: false,
        isActive: false,
      });
      cleanup.facilityIds.push(inactiveFacility.id);

      const paginatedList = await facilitiesRepository.list({
        organizationId: organizationOne.id,
        page: 1,
        pageSize: 1,
        isActive: undefined,
        type: undefined,
      });

      expect(paginatedList.pagination).toEqual({
        page: 1,
        pageSize: 1,
        totalItems: 2,
        totalPages: 2,
      });
      expect(paginatedList.items).toHaveLength(1);

      const activeList = await facilitiesRepository.list({
        organizationId: organizationOne.id,
        page: 1,
        pageSize: 20,
        isActive: true,
        type: undefined,
      });
      expect(activeList.items).toHaveLength(1);
      expect(activeList.items[0]?.id).toBe(facilityOrgOne.id);

      const limitedCreateOneInput: CreateFacilityRecord = {
        organizationId: organizationLimited.id,
        code: 'LIM-1',
        name: 'Limited One',
        type: 'BRANCH',
        ownershipType: 'OWNED',
        countryCode: 'DO',
        province: null,
        city: null,
        addressLine1: null,
        addressLine2: null,
        phone: null,
        email: null,
        isCustomerFacing: true,
        isPackageOrigin: false,
        isDistributionCenter: false,
        isActive: true,
      };
      const limitedCreateTwoInput: CreateFacilityRecord = {
        organizationId: organizationLimited.id,
        code: 'LIM-2',
        name: 'Limited Two',
        type: 'BRANCH',
        ownershipType: 'OWNED',
        countryCode: 'DO',
        province: null,
        city: null,
        addressLine1: null,
        addressLine2: null,
        phone: null,
        email: null,
        isCustomerFacing: true,
        isPackageOrigin: false,
        isDistributionCenter: false,
        isActive: true,
      };

      const concurrentPrismaOne = new PrismaClient({
        adapter: new PrismaPg({ connectionString: LOCAL_DATABASE_URL }),
      });
      const concurrentPrismaTwo = new PrismaClient({
        adapter: new PrismaPg({ connectionString: LOCAL_DATABASE_URL }),
      });
      concurrentClients.push(concurrentPrismaOne, concurrentPrismaTwo);
      await Promise.all([
        concurrentPrismaOne.$connect(),
        concurrentPrismaTwo.$connect(),
      ]);
      const concurrentRepositoryOne = new PrismaFacilitiesRepository(
        concurrentPrismaOne as unknown as PrismaService,
      );
      const concurrentRepositoryTwo = new PrismaFacilitiesRepository(
        concurrentPrismaTwo as unknown as PrismaService,
      );

      const limitedResults = await Promise.allSettled([
        concurrentRepositoryOne.create(limitedCreateOneInput),
        concurrentRepositoryTwo.create(limitedCreateTwoInput),
      ]);
      const successfulLimitedCreates = limitedResults.filter(
        (result): result is PromiseFulfilledResult<FacilityRecord> =>
          result.status === 'fulfilled',
      );
      const failedLimitedCreates = limitedResults.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      successfulLimitedCreates.forEach((result) =>
        cleanup.facilityIds.push(result.value.id),
      );

      expect(successfulLimitedCreates).toHaveLength(1);
      expect(failedLimitedCreates).toHaveLength(1);
      expect(failedLimitedCreates[0]?.reason).toBeInstanceOf(
        FacilityLimitReachedError,
      );

      const persistedLimitedFacilities = await prisma.facility.count({
        where: {
          organizationId: organizationLimited.id,
          deletedAt: null,
        },
      });
      expect(persistedLimitedFacilities).toBe(1);
    } finally {
      for (const client of concurrentClients) {
        await client.$disconnect();
      }

      if (prismaService) {
        await prismaService.employeeFacility.deleteMany({
          where: {
            facilityId: {
              in: cleanup.facilityIds,
            },
          },
        });
        await prismaService.facility.deleteMany({
          where: {
            id: {
              in: cleanup.facilityIds,
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

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  }, 30000);
});
