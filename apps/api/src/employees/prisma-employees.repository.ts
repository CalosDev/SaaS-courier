import { Injectable } from '@nestjs/common';

import {
  Prisma,
  type Employee,
  type EmployeeFacility,
  type EmployeeRole,
  type Facility,
  type Role,
  type User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmployeeCodeConflictError,
  EmployeeFacilityNotFoundError,
  EmployeeInvitationUserUnavailableError,
  EmployeeMaxUsersExceededError,
  EmployeeMembershipConflictError,
  EmployeeRoleNotFoundError,
  InvalidEmployeeInputError,
} from './employee.errors';
import { EmployeesRepository } from './employees.repository';
import type {
  EmployeeDetailRecord,
  EmployeeInvitationRepositoryResult,
  EmployeeListResult,
  InviteEmployeeRecord,
  ListEmployeesRecord,
  ReplaceEmployeeFacilitiesRecord,
  ReplaceEmployeeRolesRecord,
  UpdateEmployeeRecord,
} from './employee.types';

type OrganizationLockRow = {
  id: string;
  max_users: number;
  status: string;
  deleted_at: Date | null;
};

type EmployeeWithRelations = Employee & {
  user: Pick<User, 'id' | 'email' | 'status' | 'emailVerifiedAt'>;
  employeeFacilities: Array<
    EmployeeFacility & {
      facility: Pick<Facility, 'id' | 'code' | 'name' | 'type'>;
    }
  >;
  employeeRoles: Array<
    EmployeeRole & {
      role: Pick<Role, 'id' | 'code' | 'name' | 'isActive'>;
    }
  >;
};

@Injectable()
export class PrismaEmployeesRepository implements EmployeesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async inviteEmployee(
    input: InviteEmployeeRecord,
  ): Promise<EmployeeInvitationRepositoryResult> {
    try {
      const invitedEmployee = await this.prismaService.$transaction(
        async (tx) => {
          const existingUser = await tx.user.findUnique({
            where: {
              email: input.email,
            },
          });

          if (existingUser) {
            if (
              existingUser.deletedAt !== null ||
              existingUser.status === 'SUSPENDED' ||
              existingUser.status === 'DISABLED'
            ) {
              throw new EmployeeInvitationUserUnavailableError();
            }
          }

          let userId = existingUser?.id ?? null;
          let invitationStatus: 'invited' | 'membership_created' =
            existingUser?.status === 'ACTIVE'
              ? 'membership_created'
              : 'invited';
          let activation:
            | EmployeeInvitationRepositoryResult['activation']
            | null = null;

          const existingMembership = userId
            ? await tx.employee.findFirst({
                where: {
                  organizationId: input.organizationId,
                  userId,
                  deletedAt: null,
                },
                select: {
                  id: true,
                },
              })
            : null;

          if (existingMembership) {
            throw new EmployeeMembershipConflictError();
          }

          if (input.employeeCode) {
            const employeeCodeConflict = await tx.employee.findFirst({
              where: {
                organizationId: input.organizationId,
                employeeCode: input.employeeCode,
                deletedAt: null,
              },
              select: {
                id: true,
              },
            });

            if (employeeCodeConflict) {
              throw new EmployeeCodeConflictError(input.employeeCode);
            }
          }

          await this.assertFacilitiesBelongToOrganization(
            tx,
            input.organizationId,
            input.facilityIds,
          );
          await this.assertRolesBelongToOrganization(
            tx,
            input.organizationId,
            input.roleIds,
          );
          await this.lockOrganization(tx, input.organizationId);
          await this.assertMaxUsersAvailable(tx, input.organizationId);

          if (!existingUser) {
            const createdUser = await tx.user.create({
              data: {
                email: input.email,
                status: 'INVITED',
                passwordHash: null,
              },
            });

            userId = createdUser.id;
            invitationStatus = 'invited';
            activation = await this.createActivationToken(
              tx,
              createdUser.id,
              input,
            );
          } else if (existingUser.status === 'INVITED') {
            await tx.userActivationToken.updateMany({
              where: {
                userId: existingUser.id,
                consumedAt: null,
                invalidatedAt: null,
              },
              data: {
                invalidatedAt: new Date(),
              },
            });
            activation = await this.createActivationToken(
              tx,
              existingUser.id,
              input,
            );
          }

          if (!userId) {
            throw new InvalidEmployeeInputError(
              'Invalid employee input: user could not be resolved for invitation',
            );
          }

          const employee = await tx.employee.create({
            data: {
              organizationId: input.organizationId,
              userId,
              employeeCode: input.employeeCode,
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone,
              status: 'ACTIVE',
            },
          });

          if (input.facilityIds.length > 0) {
            await tx.employeeFacility.createMany({
              data: input.facilityIds.map((facilityId) => ({
                organizationId: input.organizationId,
                employeeId: employee.id,
                facilityId,
                isPrimary: facilityId === input.primaryFacilityId,
              })),
            });
          }

          if (input.roleIds.length > 0) {
            await tx.employeeRole.createMany({
              data: input.roleIds.map((roleId) => ({
                organizationId: input.organizationId,
                employeeId: employee.id,
                roleId,
              })),
            });
          }

          return {
            status: invitationStatus,
            employeeId: employee.id,
            activation,
          };
        },
      );

      const employee = await this.findEmployeeById(
        input.organizationId,
        invitedEmployee.employeeId,
      );

      if (!employee) {
        throw new InvalidEmployeeInputError(
          'Invalid employee input: employee could not be loaded after invite',
        );
      }

      return {
        status: invitedEmployee.status,
        employee,
        activation: invitedEmployee.activation,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (
          error instanceof EmployeeInvitationUserUnavailableError ||
          error instanceof EmployeeMaxUsersExceededError ||
          error instanceof EmployeeFacilityNotFoundError ||
          error instanceof EmployeeRoleNotFoundError
        ) {
          throw error;
        }
      }

      if (this.isEmployeeCodeConflictError(error, input.employeeCode)) {
        throw new EmployeeCodeConflictError(input.employeeCode ?? '');
      }

      if (this.isEmployeeMembershipConflictError(error)) {
        throw new EmployeeMembershipConflictError();
      }

      throw error;
    }
  }

  async listEmployees(input: ListEmployeesRecord): Promise<EmployeeListResult> {
    const where: Prisma.EmployeeWhereInput = {
      organizationId: input.organizationId,
      deletedAt: null,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.facilityId
        ? {
            employeeFacilities: {
              some: {
                facilityId: input.facilityId,
              },
            },
          }
        : {}),
      ...(input.roleId
        ? {
            employeeRoles: {
              some: {
                roleId: input.roleId,
              },
            },
          }
        : {}),
      ...(input.q
        ? {
            OR: [
              {
                employeeCode: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                firstName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  email: {
                    contains: input.q,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const totalItems = await this.prismaService.employee.count({ where });
    const employees = await this.prismaService.employee.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      skip,
      take: input.pageSize,
      include: this.employeeInclude,
    });

    return {
      items: employees.map((employee) => this.toEmployeeDetailRecord(employee)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async findEmployeeById(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDetailRecord | null> {
    const employee = await this.prismaService.employee.findFirst({
      where: {
        organizationId,
        id: employeeId,
        deletedAt: null,
      },
      include: this.employeeInclude,
    });

    return employee ? this.toEmployeeDetailRecord(employee) : null;
  }

  async updateEmployee(
    input: UpdateEmployeeRecord,
  ): Promise<EmployeeDetailRecord | null> {
    try {
      const employees = await this.prismaService.employee.updateManyAndReturn({
        where: {
          organizationId: input.organizationId,
          id: input.employeeId,
          deletedAt: null,
        },
        data: {
          ...(input.employeeCode !== undefined
            ? { employeeCode: input.employeeCode }
            : {}),
          ...(input.firstName !== undefined
            ? { firstName: input.firstName }
            : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        limit: 1,
      });
      const employee = employees[0];

      if (!employee) {
        return null;
      }

      return this.findEmployeeById(input.organizationId, employee.id);
    } catch (error) {
      if (this.isEmployeeCodeConflictError(error, input.employeeCode)) {
        throw new EmployeeCodeConflictError(input.employeeCode ?? '');
      }

      throw error;
    }
  }

  async replaceEmployeeFacilities(
    input: ReplaceEmployeeFacilitiesRecord,
  ): Promise<EmployeeDetailRecord | null> {
    const employeeId = await this.prismaService.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          organizationId: input.organizationId,
          id: input.employeeId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!employee) {
        return null;
      }

      if (employee.status === 'TERMINATED') {
        throw new InvalidEmployeeInputError(
          'Invalid employee input: terminated employees cannot be modified',
        );
      }

      await this.assertFacilitiesBelongToOrganization(
        tx,
        input.organizationId,
        input.facilityIds,
      );

      await tx.employeeFacility.deleteMany({
        where: {
          organizationId: input.organizationId,
          employeeId: input.employeeId,
        },
      });

      if (input.facilityIds.length > 0) {
        await tx.employeeFacility.createMany({
          data: input.facilityIds.map((facilityId) => ({
            organizationId: input.organizationId,
            employeeId: input.employeeId,
            facilityId,
            isPrimary: facilityId === input.primaryFacilityId,
          })),
        });
      }

      return input.employeeId;
    });

    return employeeId
      ? this.findEmployeeById(input.organizationId, employeeId)
      : null;
  }

  async replaceEmployeeRoles(
    input: ReplaceEmployeeRolesRecord,
  ): Promise<EmployeeDetailRecord | null> {
    const employeeId = await this.prismaService.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          organizationId: input.organizationId,
          id: input.employeeId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!employee) {
        return null;
      }

      if (employee.status === 'TERMINATED') {
        throw new InvalidEmployeeInputError(
          'Invalid employee input: terminated employees cannot be modified',
        );
      }

      await this.assertRolesBelongToOrganization(
        tx,
        input.organizationId,
        input.roleIds,
      );

      await tx.employeeRole.deleteMany({
        where: {
          organizationId: input.organizationId,
          employeeId: input.employeeId,
        },
      });

      if (input.roleIds.length > 0) {
        await tx.employeeRole.createMany({
          data: input.roleIds.map((roleId) => ({
            organizationId: input.organizationId,
            employeeId: input.employeeId,
            roleId,
          })),
        });
      }

      return input.employeeId;
    });

    return employeeId
      ? this.findEmployeeById(input.organizationId, employeeId)
      : null;
  }

  private get employeeInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          status: true,
          emailVerifiedAt: true,
        },
      },
      employeeFacilities: {
        where: {
          facility: {
            deletedAt: null,
            isActive: true,
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { facilityId: 'asc' }],
        include: {
          facility: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
        },
      },
      employeeRoles: {
        where: {
          role: {
            deletedAt: null,
          },
        },
        orderBy: [{ role: { code: 'asc' } }, { roleId: 'asc' }],
        include: {
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              isActive: true,
            },
          },
        },
      },
    } satisfies Prisma.EmployeeInclude;
  }

  private async createActivationToken(
    tx: Prisma.TransactionClient,
    userId: string,
    input: InviteEmployeeRecord,
  ): Promise<EmployeeInvitationRepositoryResult['activation']> {
    if (!input.activationTokenHash || !input.activationTokenExpiresAt) {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: activation token data is required',
      );
    }

    const token = await tx.userActivationToken.create({
      data: {
        userId,
        tokenHash: input.activationTokenHash,
        expiresAt: input.activationTokenExpiresAt,
      },
      select: {
        expiresAt: true,
      },
    });

    return {
      expiresAt: token.expiresAt,
    };
  }

  private async lockOrganization(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<OrganizationLockRow> {
    const rows = await tx.$queryRaw<OrganizationLockRow[]>(Prisma.sql`
      SELECT id, max_users, status, deleted_at
      FROM organizations
      WHERE id = ${organizationId}
      FOR UPDATE
    `);
    const organization = rows[0];

    if (
      !organization ||
      organization.deleted_at !== null ||
      (organization.status !== 'ACTIVE' && organization.status !== 'TRIAL')
    ) {
      throw new InvalidEmployeeInputError(
        'Invalid employee input: organization is not available',
      );
    }

    return organization;
  }

  private async assertMaxUsersAvailable(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    const organization = await tx.organization.findUniqueOrThrow({
      where: {
        id: organizationId,
      },
      select: {
        maxUsers: true,
      },
    });
    const activeMembershipCount = await tx.employee.count({
      where: {
        organizationId,
        deletedAt: null,
        status: {
          in: ['PENDING', 'ACTIVE', 'SUSPENDED'],
        },
      },
    });

    if (activeMembershipCount >= organization.maxUsers) {
      throw new EmployeeMaxUsersExceededError();
    }
  }

  private async assertFacilitiesBelongToOrganization(
    tx: Prisma.TransactionClient,
    organizationId: string,
    facilityIds: string[],
  ): Promise<void> {
    if (facilityIds.length === 0) {
      return;
    }

    const count = await tx.facility.count({
      where: {
        organizationId,
        id: {
          in: facilityIds,
        },
        deletedAt: null,
        isActive: true,
      },
    });

    if (count !== facilityIds.length) {
      throw new EmployeeFacilityNotFoundError();
    }
  }

  private async assertRolesBelongToOrganization(
    tx: Prisma.TransactionClient,
    organizationId: string,
    roleIds: string[],
  ): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }

    const count = await tx.role.count({
      where: {
        organizationId,
        id: {
          in: roleIds,
        },
        deletedAt: null,
        isActive: true,
      },
    });

    if (count !== roleIds.length) {
      throw new EmployeeRoleNotFoundError();
    }
  }

  private isEmployeeCodeConflictError(
    error: unknown,
    employeeCode: string | null | undefined,
  ): boolean {
    if (!employeeCode || !this.isKnownRequestError(error, 'P2002')) {
      return false;
    }

    const target = error.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';

    return (
      error.meta?.modelName === 'Employee' &&
      (targetText.includes('employees_organization_id_employee_code_key') ||
        targetText.includes('employeeCode'))
    );
  }

  private isEmployeeMembershipConflictError(error: unknown): boolean {
    if (!this.isKnownRequestError(error, 'P2002')) {
      return false;
    }

    const target = error.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';

    return (
      error.meta?.modelName === 'Employee' &&
      (targetText.includes('employees_organization_id_user_id_key') ||
        targetText.includes('userId'))
    );
  }

  private isKnownRequestError(
    error: unknown,
    code: string,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Error &&
      'code' in error &&
      'meta' in error &&
      error.code === code
    );
  }

  private toEmployeeDetailRecord(
    employee: EmployeeWithRelations,
  ): EmployeeDetailRecord {
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      status: employee.status,
      user: {
        id: employee.user.id,
        email: employee.user.email,
        status: employee.user.status,
        emailVerifiedAt: employee.user.emailVerifiedAt,
      },
      facilities: employee.employeeFacilities.map((employeeFacility) => ({
        id: employeeFacility.facility.id,
        code: employeeFacility.facility.code,
        name: employeeFacility.facility.name,
        type: employeeFacility.facility.type,
        isPrimary: employeeFacility.isPrimary,
      })),
      roles: employee.employeeRoles.map((employeeRole) => ({
        id: employeeRole.role.id,
        code: employeeRole.role.code,
        name: employeeRole.role.name,
        isActive: employeeRole.role.isActive,
      })),
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
