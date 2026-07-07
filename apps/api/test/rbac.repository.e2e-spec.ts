import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import {
  EmployeeRoleConflictError,
  RoleCodeConflictError,
  RbacScopeMismatchError,
} from '../src/rbac/rbac.errors';
import { RbacService } from '../src/rbac/rbac.service';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Rbac integration', () => {
  it('synchronizes permissions, creates roles, assigns roles, evaluates permissions, and enforces tenant scope', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanupIds = {
      roleIds: [] as string[],
      employeeIds: [] as string[],
      userIds: [] as string[],
      organizationIds: [] as string[],
    };
    const deactivatedPermissionCodes = new Set<string>();

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      prismaService = moduleRef.get<PrismaService>(PrismaService);
      const rbacService = moduleRef.get<RbacService>(RbacService);
      const testPrefix = `ticket12-${randomUUID()}`;

      const firstSync = await rbacService.syncPermissionCatalog();
      const secondSync = await rbacService.syncPermissionCatalog();

      expect(firstSync.totalActiveCatalogPermissions).toBe(21);
      expect(secondSync.totalActiveCatalogPermissions).toBe(21);

      const organizationOne = await prismaService.organization.create({
        data: {
          legalName: `${testPrefix}-org-one-legal`,
          commercialName: `${testPrefix}-org-one`,
          slug: `${testPrefix}-org-one`,
        },
      });
      cleanupIds.organizationIds.push(organizationOne.id);

      const organizationTwo = await prismaService.organization.create({
        data: {
          legalName: `${testPrefix}-org-two-legal`,
          commercialName: `${testPrefix}-org-two`,
          slug: `${testPrefix}-org-two`,
        },
      });
      cleanupIds.organizationIds.push(organizationTwo.id);

      const userOne = await prismaService.user.create({
        data: {
          email: `${testPrefix}-user-one@courier.test`,
          status: 'ACTIVE',
        },
      });
      cleanupIds.userIds.push(userOne.id);

      const userTwo = await prismaService.user.create({
        data: {
          email: `${testPrefix}-user-two@courier.test`,
          status: 'ACTIVE',
        },
      });
      cleanupIds.userIds.push(userTwo.id);

      const employeeOne = await prismaService.employee.create({
        data: {
          organizationId: organizationOne.id,
          userId: userOne.id,
          firstName: 'Employee',
          lastName: 'One',
          status: 'ACTIVE',
        },
      });
      cleanupIds.employeeIds.push(employeeOne.id);

      const employeeTwo = await prismaService.employee.create({
        data: {
          organizationId: organizationTwo.id,
          userId: userTwo.id,
          firstName: 'Employee',
          lastName: 'Two',
          status: 'ACTIVE',
        },
      });
      cleanupIds.employeeIds.push(employeeTwo.id);

      const roleOne = await rbacService.createRole({
        organizationId: organizationOne.id,
        code: 'ops_manager',
        name: 'Operations Manager',
        permissionCodes: ['permissions.read', 'roles.read'],
      });
      cleanupIds.roleIds.push(roleOne.id);

      await rbacService.assignRoleToEmployee({
        organizationId: organizationOne.id,
        employeeId: employeeOne.id,
        roleId: roleOne.id,
      });

      await expect(
        rbacService.hasPermission({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          permissionCode: 'permissions.read',
        }),
      ).resolves.toBe(true);

      await expect(
        rbacService.hasPermission({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          permissionCode: 'organizations.manage',
        }),
      ).resolves.toBe(false);

      await expect(
        rbacService.getEffectivePermissionCodes({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
        }),
      ).resolves.toEqual(['permissions.read', 'roles.read']);

      await expect(
        rbacService.createRole({
          organizationId: organizationOne.id,
          code: 'OPS_MANAGER',
          name: 'Operations Manager Duplicate',
        }),
      ).rejects.toBeInstanceOf(RoleCodeConflictError);

      const roleTwo = await rbacService.createRole({
        organizationId: organizationTwo.id,
        code: 'OPS_MANAGER',
        name: 'Operations Manager',
      });
      cleanupIds.roleIds.push(roleTwo.id);

      await expect(
        rbacService.assignRoleToEmployee({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          roleId: roleOne.id,
        }),
      ).rejects.toBeInstanceOf(EmployeeRoleConflictError);

      await expect(
        rbacService.assignRoleToEmployee({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          roleId: roleTwo.id,
        }),
      ).rejects.toBeInstanceOf(RbacScopeMismatchError);

      await prismaService.role.update({
        where: { id: roleOne.id },
        data: { isActive: false },
      });
      await expect(
        rbacService.getEffectivePermissionCodes({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
        }),
      ).resolves.toEqual([]);

      await prismaService.role.update({
        where: { id: roleOne.id },
        data: {
          isActive: true,
          deletedAt: new Date('2026-06-28T00:00:00.000Z'),
        },
      });
      await expect(
        rbacService.getEffectivePermissionCodes({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
        }),
      ).resolves.toEqual([]);

      await prismaService.role.update({
        where: { id: roleOne.id },
        data: { deletedAt: null },
      });

      await prismaService.permission.update({
        where: { code: 'permissions.read' },
        data: { isActive: false },
      });
      deactivatedPermissionCodes.add('permissions.read');

      await expect(
        rbacService.getEffectivePermissionCodes({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
        }),
      ).resolves.toEqual(['roles.read']);

      await prismaService.permission.update({
        where: { code: 'permissions.read' },
        data: { isActive: true },
      });
      deactivatedPermissionCodes.delete('permissions.read');

      await prismaService.employee.update({
        where: { id: employeeOne.id },
        data: { status: 'SUSPENDED' },
      });
      await expect(
        rbacService.hasPermission({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          permissionCode: 'roles.read',
        }),
      ).resolves.toBe(false);

      await prismaService.employee.update({
        where: { id: employeeOne.id },
        data: { status: 'ACTIVE' },
      });

      await prismaService.user.update({
        where: { id: userOne.id },
        data: { status: 'DISABLED' },
      });
      await expect(
        rbacService.hasPermission({
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          permissionCode: 'roles.read',
        }),
      ).resolves.toBe(false);
    } finally {
      if (prismaService) {
        for (const code of deactivatedPermissionCodes) {
          await prismaService.permission.update({
            where: { code },
            data: { isActive: true },
          });
        }

        for (const roleId of cleanupIds.roleIds) {
          await prismaService.rolePermission.deleteMany({
            where: { roleId },
          });
        }

        for (const roleId of cleanupIds.roleIds) {
          await prismaService.employeeRole.deleteMany({
            where: { roleId },
          });
        }

        for (const roleId of cleanupIds.roleIds) {
          await prismaService.role.deleteMany({
            where: { id: roleId },
          });
        }

        for (const employeeId of cleanupIds.employeeIds) {
          await prismaService.employee.deleteMany({
            where: { id: employeeId },
          });
        }

        for (const userId of cleanupIds.userIds) {
          await prismaService.user.deleteMany({
            where: { id: userId },
          });
        }

        for (const organizationId of cleanupIds.organizationIds) {
          await prismaService.organization.deleteMany({
            where: { id: organizationId },
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
  });
});
