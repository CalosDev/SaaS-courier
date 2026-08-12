import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { ActivationTokenService } from '../src/accounts/activation-token.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrganizationProvisioningConflictError } from '../src/provisioning/organization-provisioning.errors';
import { OrganizationProvisioningService } from '../src/provisioning/organization-provisioning.service';
import type { ProvisionOrganizationInput } from '../src/provisioning/organization-provisioning.types';
import { PERMISSION_CATALOG } from '../src/rbac/permission.catalog';
import { RbacService } from '../src/rbac/rbac.service';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('OrganizationProvisioningService repository integration', () => {
  let moduleRef: TestingModule | null = null;
  let prisma: PrismaService | null = null;
  const organizationIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
  });

  it('provisions atomically and rolls back a conflicting administrator', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const database = moduleRef.get(PrismaService);
      prisma = database;
      const service = moduleRef.get(OrganizationProvisioningService);
      const activationTokens = moduleRef.get(ActivationTokenService);
      await moduleRef.get(RbacService).syncPermissionCatalog();

      const suffix = randomUUID();
      const input = buildInput(suffix);
      const result = await service.provision(input);
      organizationIds.push(result.organizationId);

      const organization = await database.organization.findUniqueOrThrow({
        where: { id: result.organizationId },
        include: {
          settings: true,
          regulatoryProfile: true,
          facilities: true,
          employees: {
            include: {
              user: { include: { activationTokens: true } },
              employeeFacilities: true,
              employeeRoles: {
                include: {
                  role: { include: { rolePermissions: true } },
                },
              },
            },
          },
        },
      });
      const employee = organization.employees[0];
      const role = employee.employeeRoles[0]?.role;
      userIds.push(employee.userId);

      expect(organization).toMatchObject({
        slug: input.organization.slug,
        status: 'TRIAL',
        settings: expect.any(Object),
        regulatoryProfile: {
          courierRegistrationStatus: 'IN_PROCESS',
          electronicInvoicingStatus: 'NOT_ENROLLED',
        },
      });
      expect(organization.facilities).toHaveLength(1);
      expect(employee).toMatchObject({ status: 'PENDING' });
      expect(employee.user).toMatchObject({
        email: input.administrator.email,
        status: 'INVITED',
        passwordHash: null,
      });
      expect(employee.user.activationTokens).toHaveLength(1);
      expect(employee.user.activationTokens[0]?.tokenHash).toBe(
        activationTokens.hashToken(result.activationToken),
      );
      expect(role).toMatchObject({
        code: 'ORGANIZATION_ADMIN',
        isSystem: true,
      });
      expect(role?.rolePermissions).toHaveLength(PERMISSION_CATALOG.length);
      expect(employee.employeeFacilities).toEqual([
        expect.objectContaining({
          facilityId: result.facilityId,
          isPrimary: true,
        }),
      ]);

      const conflictInput = buildInput(randomUUID());
      await expect(
        service.provision({
          ...conflictInput,
          organization: {
            ...conflictInput.organization,
            commercialName: 'Rollback sentinel',
          },
          administrator: { ...input.administrator },
        }),
      ).rejects.toBeInstanceOf(OrganizationProvisioningConflictError);

      expect(
        await database.organization.count({
          where: { commercialName: 'Rollback sentinel' },
        }),
      ).toBe(0);
      expect(
        await database.auditLog.count({
          where: {
            organizationId: result.organizationId,
            action: 'organization.provisioned',
          },
        }),
      ).toBe(1);
      expect(
        await database.outboxEvent.count({
          where: {
            organizationId: result.organizationId,
            eventType: 'organization.provisioned',
          },
        }),
      ).toBe(1);
    } finally {
      await cleanup(prisma, organizationIds, userIds);
      if (moduleRef) await moduleRef.close();
    }
  }, 120_000);
});

function buildInput(suffix: string): ProvisionOrganizationInput {
  return {
    organization: {
      legalName: `Provisioning Legal ${suffix}`,
      commercialName: `Provisioning Courier ${suffix}`,
      slug: `provisioning-${suffix}`,
      rnc: suffix.replaceAll('-', '').slice(0, 11),
      email: `office.${suffix}@courier.test`,
    },
    regulatoryProfile: {
      fiscalAddress: 'Santo Domingo, Republica Dominicana',
      authorizedRepresentativeName: 'Ada Lovelace',
      courierRegistrationStatus: 'IN_PROCESS',
      dgaOperatorCode: `DGA-${suffix.slice(0, 8)}`,
      electronicInvoicingStatus: 'NOT_ENROLLED',
    },
    primaryFacility: {
      code: `HQ-${suffix.slice(0, 8)}`,
      name: 'Centro principal',
      type: 'BRANCH',
      countryCode: 'DO',
      addressLine1: 'Santo Domingo',
      isPackageOrigin: true,
    },
    administrator: {
      email: `admin.${suffix}@courier.test`,
      firstName: 'Ada',
      lastName: 'Lovelace',
      employeeCode: `ADM-${suffix.slice(0, 8)}`,
    },
  };
}

async function cleanup(
  prisma: PrismaService | null,
  organizationIds: string[],
  userIds: string[],
) {
  if (!prisma || organizationIds.length === 0) return;
  await deleteAuditArtifactsForOrganizations(prisma, organizationIds);
  await prisma.employeeFacility.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.employeeRole.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.rolePermission.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.role.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.userActivationToken.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.employee.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.facility.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.organizationRegulatoryProfile.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.organizationSettings.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: organizationIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
