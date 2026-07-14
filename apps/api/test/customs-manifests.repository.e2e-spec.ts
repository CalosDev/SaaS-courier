import {
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { CustomsManifestsService } from '../src/customs-manifests/customs-manifests.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Versioned customs manifests integration', () => {
  it('freezes version snapshots and enforces tenant-safe finalization', async () => {
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
      const service = moduleRef.get(CustomsManifestsService);
      const suffix = randomUUID();
      const [organization, otherOrganization] = await Promise.all([
        createOrganization(prisma, `manifest-${suffix}`),
        createOrganization(prisma, `manifest-other-${suffix}`),
      ]);
      organizationIds.push(organization.id, otherOrganization.id);
      await prisma.organizationSettings.createMany({
        data: organizationIds.map((organizationId) => ({ organizationId })),
      });
      const [user, otherUser] = await Promise.all([
        prisma.user.create({
          data: { email: `manifest.${suffix}@courier.test`, status: 'ACTIVE' },
        }),
        prisma.user.create({
          data: {
            email: `manifest.other.${suffix}@courier.test`,
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
      const [origin, destination] = await Promise.all([
        createFacility(prisma, organization.id, 'MIA', true),
        createFacility(prisma, organization.id, 'SDQ', false),
      ]);
      facilityIds.push(origin.id, destination.id);
      const customer = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: `MF${suffix.slice(0, 8).toUpperCase()}`,
          type: 'INDIVIDUAL',
          firstName: 'Manifest',
          lastName: 'Customer',
          status: 'ACTIVE',
        },
      });
      customerIds.push(customer.id);
      const shipment = await prisma.dispatch.create({
        data: {
          organizationId: organization.id,
          dispatchCode: `DSP-${suffix.slice(0, 8)}`,
          status: 'ARRIVED',
          originFacilityId: origin.id,
          destinationFacilityId: destination.id,
          origin: origin.code,
          destination: destination.code,
          transportMode: 'AIR',
          mawb: `MAWB-${suffix.slice(0, 8)}`,
        },
      });
      const pkg = await prisma.package.create({
        data: {
          organizationId: organization.id,
          customerId: customer.id,
          registeredByEmployeeId: employee.id,
          dispatchId: shipment.id,
          internalTrackingNumber: buildPackageCode(),
          externalTrackingNumber: `ORIGINAL-${suffix}`,
          externalTrackingNumberNormalized: `ORIGINAL${suffix}`
            .replace(/[^A-Z0-9]/gi, '')
            .toUpperCase(),
          status: 'ARRIVED_AT_DESTINATION',
        },
      });
      packageIds.push(pkg.id);

      const context = buildContext(organization.id, employee.id, user.id);
      const otherContext = buildContext(
        otherOrganization.id,
        otherEmployee.id,
        otherUser.id,
      );
      const manifest = await service.create(context, {
        masterShipmentId: shipment.id,
        flightNumber: 'AA123',
        arrivalDate: '2026-07-12',
      });
      await expect(
        service.findDetailById(otherContext, manifest.id),
      ).rejects.toThrow(NotFoundException);

      const versionOne = await service.buildVersion(context, manifest.id);
      await prisma.package.update({
        where: {
          organizationId_id: { organizationId: organization.id, id: pkg.id },
        },
        data: {
          externalTrackingNumber: `UPDATED-${suffix}`,
          externalTrackingNumberNormalized: `UPDATED${suffix}`
            .replace(/[^A-Z0-9]/gi, '')
            .toUpperCase(),
        },
      });
      const versionTwo = await service.buildVersion(context, manifest.id);
      expect(versionTwo.versionNumber).toBe(2);

      const persistedVersionOne =
        await prisma.customsManifestVersion.findUniqueOrThrow({
          where: {
            organizationId_id: {
              organizationId: organization.id,
              id: versionOne.id,
            },
          },
          include: { items: true },
        });
      expect(persistedVersionOne.items[0].itemSnapshot).toMatchObject({
        externalTrackingNumber: `ORIGINAL-${suffix}`,
      });
      expect(versionTwo.items[0].itemSnapshot).toMatchObject({
        externalTrackingNumber: `UPDATED-${suffix}`,
      });

      const validated = await service.validateVersion(context, manifest.id);
      expect(validated.validationStatus).toBe('VALID');
      const finalized = await service.finalize(context, manifest.id);
      expect(finalized).toMatchObject({
        status: 'FINALIZED',
        finalizedVersionId: versionTwo.id,
      });
      await expect(service.buildVersion(context, manifest.id)).rejects.toThrow(
        ConflictException,
      );

      const cancellable = await service.create(context, {
        masterShipmentId: shipment.id,
        flightNumber: 'AA124',
      });
      await expect(
        service.cancel(context, cancellable.id),
      ).resolves.toMatchObject({
        status: 'CANCELLED',
      });
    } finally {
      if (prismaService) {
        await prismaService.customsManifest.updateMany({
          where: { organizationId: { in: organizationIds } },
          data: { finalizedVersionId: null },
        });
        await prismaService.customsManifestItem.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.customsManifestVersion.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.customsManifest.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await deleteAuditArtifactsForOrganizations(
          prismaService,
          organizationIds,
        );
        await prismaService.package.deleteMany({
          where: { id: { in: packageIds } },
        });
        await prismaService.dispatch.deleteMany({
          where: { organizationId: { in: organizationIds } },
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
    data: { legalName: slug, commercialName: slug, slug, status: 'ACTIVE' },
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
      firstName: 'Manifest',
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
