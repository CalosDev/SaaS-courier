import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { DispatchesService } from '../src/dispatches/dispatches.service';
import { HouseShipmentsService } from '../src/house-shipments/house-shipments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Master shipments and HAWB integration', () => {
  it('moves packages through a tenant-safe international shipment', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const organizationIds: string[] = [];
    const userIds: string[] = [];
    const employeeIds: string[] = [];
    const facilityIds: string[] = [];
    const customerIds: string[] = [];
    const packageIds: string[] = [];

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;
      process.env.NODE_ENV = 'test';
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const dispatches = moduleRef.get(DispatchesService);
      const houseShipments = moduleRef.get(HouseShipmentsService);
      const suffix = randomUUID();

      const [organization, otherOrganization] = await Promise.all([
        createOrganization(prisma, `shipments-${suffix}`),
        createOrganization(prisma, `shipments-other-${suffix}`),
      ]);
      organizationIds.push(organization.id, otherOrganization.id);
      await prisma.organizationSettings.createMany({
        data: organizationIds.map((organizationId) => ({ organizationId })),
      });

      const [user, otherUser] = await Promise.all([
        prisma.user.create({
          data: { email: `shipments.${suffix}@courier.test`, status: 'ACTIVE' },
        }),
        prisma.user.create({
          data: {
            email: `shipments.other.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
        }),
      ]);
      userIds.push(user.id, otherUser.id);
      const [employee, otherEmployee] = await Promise.all([
        createEmployee(prisma, organization.id, user.id),
        createEmployee(prisma, otherOrganization.id, otherUser.id),
      ]);
      employeeIds.push(employee.id, otherEmployee.id);

      const [origin, destination, foreignFacility] = await Promise.all([
        createFacility(prisma, organization.id, 'MIA', true),
        createFacility(prisma, organization.id, 'SDQ', false),
        createFacility(prisma, otherOrganization.id, 'FOREIGN', true),
      ]);
      facilityIds.push(origin.id, destination.id, foreignFacility.id);
      const customer = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: `SH${suffix.slice(0, 8).toUpperCase()}`,
          type: 'INDIVIDUAL',
          firstName: 'Shipment',
          lastName: 'Customer',
          status: 'ACTIVE',
        },
      });
      customerIds.push(customer.id);
      const packages = await Promise.all([
        createPackage(
          prisma,
          organization.id,
          customer.id,
          employee.id,
          suffix,
          1,
        ),
        createPackage(
          prisma,
          organization.id,
          customer.id,
          employee.id,
          suffix,
          2,
        ),
      ]);
      packageIds.push(...packages.map((pkg) => pkg.id));

      const context = buildContext(organization.id, employee.id, user.id);
      const otherContext = buildContext(
        otherOrganization.id,
        otherEmployee.id,
        otherUser.id,
      );
      await expect(
        dispatches.createMasterShipment(context, {
          originFacilityId: origin.id,
          destinationFacilityId: foreignFacility.id,
          transportMode: 'AIR',
        }),
      ).rejects.toThrow(NotFoundException);

      const shipment = await dispatches.createMasterShipment(context, {
        originFacilityId: origin.id,
        destinationFacilityId: destination.id,
        transportMode: 'AIR',
        carrier: 'Integration Air',
      });
      await expect(
        dispatches.getDispatchById(otherContext.organizationId, shipment.id),
      ).rejects.toThrow(NotFoundException);
      await dispatches.replaceMasterShipmentPackages(context, shipment.id, {
        packageIds,
      });

      const hawb = await houseShipments.create(context, shipment.id, {
        hawb: `HAWB-${suffix}`,
      });
      await expect(
        houseShipments.findById(otherContext, hawb.id),
      ).rejects.toThrow(NotFoundException);
      await houseShipments.addPackages(context, hawb.id, { packageIds });
      await houseShipments.close(context, hawb.id);

      await dispatches.closeMasterShipment(context, shipment.id);
      await dispatches.departMasterShipment(context, shipment.id);
      expect(
        await prisma.package.count({
          where: { id: { in: packageIds }, status: 'IN_TRANSIT' },
        }),
      ).toBe(2);
      await dispatches.arriveMasterShipment(context, shipment.id);
      expect(
        await prisma.package.count({
          where: {
            id: { in: packageIds },
            status: 'ARRIVED_AT_DESTINATION',
          },
        }),
      ).toBe(2);

      const persisted = await prisma.dispatch.findUniqueOrThrow({
        where: {
          organizationId_id: {
            organizationId: organization.id,
            id: shipment.id,
          },
        },
      });
      expect(persisted).toMatchObject({
        status: 'ARRIVED',
        originFacilityId: origin.id,
        destinationFacilityId: destination.id,
        transportMode: 'AIR',
      });
    } finally {
      if (prismaService) {
        await prismaService.houseShipmentPackage.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.houseShipment.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.package.updateMany({
          where: { id: { in: packageIds } },
          data: { dispatchId: null },
        });
        await prismaService.dispatch.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await deleteAuditArtifactsForOrganizations(
          prismaService,
          organizationIds,
        );
        await prismaService.package.deleteMany({
          where: { id: { in: packageIds } },
        });
        await prismaService.customer.deleteMany({
          where: { id: { in: customerIds } },
        });
        await prismaService.employee.deleteMany({
          where: { id: { in: employeeIds } },
        });
        await prismaService.facility.deleteMany({
          where: { id: { in: facilityIds } },
        });
        await prismaService.user.deleteMany({ where: { id: { in: userIds } } });
        await prismaService.organizationSettings.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      await app?.close();
      await moduleRef?.close();
    }
  }, 120_000);
});

function createOrganization(prisma: PrismaService, slug: string) {
  return prisma.organization.create({
    data: {
      legalName: slug,
      commercialName: slug,
      slug,
      status: 'ACTIVE',
    },
  });
}

function createEmployee(
  prisma: PrismaService,
  organizationId: string,
  userId: string,
) {
  return prisma.employee.create({
    data: {
      organizationId,
      userId,
      firstName: 'Shipment',
      lastName: 'Operator',
      status: 'ACTIVE',
    },
  });
}

function createFacility(
  prisma: PrismaService,
  organizationId: string,
  code: string,
  isPackageOrigin: boolean,
) {
  return prisma.facility.create({
    data: {
      organizationId,
      code,
      name: code,
      type: isPackageOrigin ? 'INTERNATIONAL_WAREHOUSE' : 'DISTRIBUTION_CENTER',
      isPackageOrigin,
      isActive: true,
    },
  });
}

function createPackage(
  prisma: PrismaService,
  organizationId: string,
  customerId: string,
  employeeId: string,
  suffix: string,
  index: number,
) {
  return prisma.package.create({
    data: {
      organizationId,
      customerId,
      registeredByEmployeeId: employeeId,
      internalTrackingNumber: buildPackageCode(),
      externalTrackingNumber: `SHIP-${suffix}-${index}`,
      externalTrackingNumberNormalized: `SHIP${suffix}${index}`
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase(),
      status: 'RECEIVED_AT_ORIGIN',
    },
  });
}

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

function buildPackageCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'PK';
  while (value.length < 14) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}
