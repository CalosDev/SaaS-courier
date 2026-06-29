import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmployeeRoleConflictError,
  PermissionCatalogNotSynchronizedError,
  RbacScopeMismatchError,
  RoleCodeConflictError,
  RoleNotFoundError,
} from './rbac.errors';
import { RbacRepository } from './rbac.repository';
import type {
  AssignRoleToEmployeeRecord,
  CreateRoleRecord,
  PermissionCatalogSyncResult,
  PermissionDefinition,
  PermissionEvaluationRecord,
  RoleRecord,
} from './rbac.types';

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: {
    rolePermissions: {
      include: {
        permission: {
          select: {
            code: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class PrismaRbacRepository implements RbacRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async syncPermissionCatalog(
    definitions: readonly PermissionDefinition[],
  ): Promise<PermissionCatalogSyncResult> {
    return this.prismaService.$transaction(async (tx) => {
      const codes = definitions.map((definition) => definition.code);
      const existingPermissions = await tx.permission.findMany({
        where: {
          code: {
            in: codes,
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isActive: true,
        },
      });

      const permissionsByCode = new Map(
        existingPermissions.map((permission) => [permission.code, permission]),
      );

      let inserted = 0;
      let updated = 0;
      let reactivated = 0;
      let unchanged = 0;

      for (const definition of definitions) {
        const existingPermission = permissionsByCode.get(definition.code);

        if (!existingPermission) {
          await tx.permission.create({
            data: {
              code: definition.code,
              name: definition.name,
              description: definition.description,
              isActive: true,
            },
          });
          inserted += 1;
          continue;
        }

        const currentDescription = existingPermission.description ?? null;
        const nextDescription = definition.description;
        const metadataChanged =
          existingPermission.name !== definition.name ||
          currentDescription !== nextDescription;
        const needsReactivation = !existingPermission.isActive;

        if (!metadataChanged && !needsReactivation) {
          unchanged += 1;
          continue;
        }

        await tx.permission.update({
          where: { id: existingPermission.id },
          data: {
            name: definition.name,
            description: nextDescription,
            isActive: true,
          },
        });

        if (needsReactivation) {
          reactivated += 1;
        } else {
          updated += 1;
        }
      }

      return {
        inserted,
        updated,
        reactivated,
        unchanged,
        totalActiveCatalogPermissions: definitions.length,
      };
    });
  }

  async createRoleWithPermissions(
    input: CreateRoleRecord,
  ): Promise<RoleRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const permissions =
          input.permissionCodes.length === 0
            ? []
            : await tx.permission.findMany({
                where: {
                  code: {
                    in: input.permissionCodes,
                  },
                  isActive: true,
                },
                select: {
                  id: true,
                  code: true,
                },
              });

        if (permissions.length !== input.permissionCodes.length) {
          throw new PermissionCatalogNotSynchronizedError();
        }

        const role = await tx.role.create({
          data: {
            organizationId: input.organizationId,
            code: input.code,
            name: input.name,
            description: input.description,
            isSystem: input.isSystem,
          },
        });

        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((permission) => ({
              organizationId: input.organizationId,
              roleId: role.id,
              permissionId: permission.id,
            })),
          });
        }

        const persistedRole = await tx.role.findUniqueOrThrow({
          where: {
            id: role.id,
          },
          include: {
            rolePermissions: {
              include: {
                permission: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        });

        return this.toRoleRecord(persistedRole);
      });
    } catch (error) {
      if (error instanceof PermissionCatalogNotSynchronizedError) {
        throw error;
      }

      if (this.isRoleCodeConflictError(error)) {
        throw new RoleCodeConflictError(input.code);
      }

      throw error;
    }
  }

  async assignRoleToEmployee(input: AssignRoleToEmployeeRecord): Promise<void> {
    const role = await this.prismaService.role.findUnique({
      where: {
        id: input.roleId,
      },
      select: {
        id: true,
        organizationId: true,
        deletedAt: true,
      },
    });

    if (!role) {
      throw new RoleNotFoundError(input.roleId);
    }

    if (
      role.organizationId !== input.organizationId ||
      role.deletedAt !== null
    ) {
      throw new RbacScopeMismatchError();
    }

    const employee = await this.prismaService.employee.findUnique({
      where: {
        id: input.employeeId,
      },
      select: {
        id: true,
        organizationId: true,
        deletedAt: true,
      },
    });

    if (
      !employee ||
      employee.organizationId !== input.organizationId ||
      employee.deletedAt !== null
    ) {
      throw new RbacScopeMismatchError();
    }

    try {
      await this.prismaService.employeeRole.create({
        data: {
          organizationId: input.organizationId,
          employeeId: input.employeeId,
          roleId: input.roleId,
        },
      });
    } catch (error) {
      if (this.isEmployeeRoleConflictError(error)) {
        throw new EmployeeRoleConflictError();
      }

      if (this.isScopeMismatchError(error)) {
        throw new RbacScopeMismatchError();
      }

      throw error;
    }
  }

  async findEffectivePermissionCodes(
    input: PermissionEvaluationRecord,
  ): Promise<string[]> {
    const permissions = await this.prismaService.permission.findMany({
      where: {
        isActive: true,
        rolePermissions: {
          some: {
            organizationId: input.organizationId,
            role: {
              organizationId: input.organizationId,
              isActive: true,
              deletedAt: null,
              employeeRoles: {
                some: {
                  organizationId: input.organizationId,
                  employeeId: input.employeeId,
                  employee: {
                    organizationId: input.organizationId,
                    status: 'ACTIVE',
                    deletedAt: null,
                    user: {
                      status: 'ACTIVE',
                      deletedAt: null,
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        code: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    return permissions.map((permission) => permission.code);
  }

  private isRoleCodeConflictError(error: unknown): boolean {
    if (!this.isKnownRequestError(error) || error.code !== 'P2002') {
      return false;
    }

    if (error.meta?.modelName !== 'Role') {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.some(
        (entry) =>
          typeof entry === 'string' &&
          (entry.includes('roles_organization_id_code_key') ||
            entry.includes('organizationId') ||
            entry.includes('code')),
      );
    }

    if (typeof target === 'string') {
      return (
        target.includes('roles_organization_id_code_key') ||
        target.includes('organizationId') ||
        target.includes('code')
      );
    }

    return true;
  }

  private isEmployeeRoleConflictError(error: unknown): boolean {
    if (!this.isKnownRequestError(error) || error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.some(
        (entry) =>
          typeof entry === 'string' &&
          (entry.includes(
            'employee_roles_organization_id_employee_id_role_id_key',
          ) ||
            entry.includes('employeeId') ||
            entry.includes('roleId')),
      );
    }

    if (typeof target === 'string') {
      return (
        target.includes(
          'employee_roles_organization_id_employee_id_role_id_key',
        ) ||
        target.includes('employeeId') ||
        target.includes('roleId')
      );
    }

    return error.meta?.modelName === 'EmployeeRole';
  }

  private isScopeMismatchError(error: unknown): boolean {
    return this.isKnownRequestError(error) && error.code === 'P2003';
  }

  private isKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Error && 'code' in error && 'meta' in error;
  }

  private toRoleRecord(role: RoleWithPermissions): RoleRecord {
    return {
      id: role.id,
      organizationId: role.organizationId,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      deletedAt: role.deletedAt,
      permissionCodes: role.rolePermissions
        .map((rolePermission) => rolePermission.permission.code)
        .sort((left, right) => left.localeCompare(right)),
    };
  }
}
