import { NestFactory } from '@nestjs/core';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { AppModule } from '../src/app.module';
import { getLocalBootstrapConfig } from '../src/local-development/local-bootstrap.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/rbac/rbac.service';

const ORGANIZATION_SLUG = 'courier-local';
const FACILITY_CODE = 'SDQ-01';
const ROLE_CODE = 'LOCAL_ADMIN';

async function main(): Promise<void> {
  const config = getLocalBootstrapConfig(process.env);
  const applicationContext = await NestFactory.createApplicationContext(
    AppModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const prisma = applicationContext.get(PrismaService);
    const passwordHasher = applicationContext.get(PasswordHasher);
    const rbac = applicationContext.get(RbacService);

    await rbac.syncPermissionCatalog();
    const passwordHash = await passwordHasher.hash(config.password);

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { slug: ORGANIZATION_SLUG },
        create: {
          legalName: 'Courier Local SRL',
          commercialName: 'Courier Local',
          slug: ORGANIZATION_SLUG,
          status: 'ACTIVE',
          email: config.email,
        },
        update: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      });

      await tx.organizationSettings.upsert({
        where: { organizationId: organization.id },
        create: { organizationId: organization.id },
        update: {},
      });

      await tx.organizationRegulatoryProfile.upsert({
        where: { organizationId: organization.id },
        create: { organizationId: organization.id },
        update: {},
      });

      const facility = await tx.facility.upsert({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: FACILITY_CODE,
          },
        },
        create: {
          organizationId: organization.id,
          code: FACILITY_CODE,
          name: 'Sucursal Santo Domingo',
          type: 'BRANCH',
          province: 'Distrito Nacional',
          city: 'Santo Domingo',
          isCustomerFacing: true,
          isPackageOrigin: true,
          isDistributionCenter: true,
        },
        update: {
          isActive: true,
          deletedAt: null,
        },
      });

      const user = await tx.user.upsert({
        where: { email: config.email },
        create: {
          email: config.email,
          passwordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
        },
        update: {
          passwordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
          failedLoginAttempts: 0,
          lockedUntil: null,
          deletedAt: null,
        },
      });

      const employee = await tx.employee.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        create: {
          organizationId: organization.id,
          userId: user.id,
          employeeCode: 'ADMIN-LOCAL',
          firstName: 'Administrador',
          lastName: 'Local',
          status: 'ACTIVE',
        },
        update: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      });

      const role = await tx.role.upsert({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: ROLE_CODE,
          },
        },
        create: {
          organizationId: organization.id,
          code: ROLE_CODE,
          name: 'Administrador local',
          description: 'Rol completo para validacion local del producto',
          isSystem: true,
        },
        update: {
          isActive: true,
          deletedAt: null,
        },
      });

      await tx.employeeFacility.upsert({
        where: {
          organizationId_employeeId_facilityId: {
            organizationId: organization.id,
            employeeId: employee.id,
            facilityId: facility.id,
          },
        },
        create: {
          organizationId: organization.id,
          employeeId: employee.id,
          facilityId: facility.id,
          isPrimary: true,
        },
        update: { isPrimary: true },
      });

      await tx.employeeRole.upsert({
        where: {
          organizationId_employeeId_roleId: {
            organizationId: organization.id,
            employeeId: employee.id,
            roleId: role.id,
          },
        },
        create: {
          organizationId: organization.id,
          employeeId: employee.id,
          roleId: role.id,
        },
        update: {},
      });

      const permissions = await tx.permission.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          organizationId: organization.id,
          roleId: role.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });

      return {
        organization: organization.slug,
        facility: facility.code,
        settings: true,
        permissions: permissions.length,
      };
    });

    console.log(
      `Local bootstrap ready organization=${result.organization} facility=${result.facility} settings=${result.settings} permissions=${result.permissions} email=${config.email}`,
    );
  } finally {
    await applicationContext.close();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown bootstrap error';
  console.error(`Local bootstrap failed: ${message}`);
  process.exitCode = 1;
});
