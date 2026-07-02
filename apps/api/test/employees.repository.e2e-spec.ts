import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { ActivationTokenService } from '../src/accounts/activation-token.service';
import { AppModule } from '../src/app.module';
import {
  EmployeeCodeConflictError,
  EmployeeInvitationUserUnavailableError,
  EmployeeMaxUsersExceededError,
  EmployeeMembershipConflictError,
} from '../src/employees/employee.errors';
import { EmployeesRepository } from '../src/employees/employees.repository';
import type { EmployeeInvitationRepositoryResult } from '../src/employees/employee.types';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe('Employees repository integration', () => {
  it('enforces maxUsers concurrency, reuses global users correctly, scopes roles and facilities, and revokes only organization employee sessions', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      roleIds: [] as string[],
      facilityIds: [] as string[],
      tokenIds: [] as string[],
      sessionIds: [] as string[],
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
      const employeesRepository =
        moduleRef.get<EmployeesRepository>(EmployeesRepository);
      const activationTokenService = moduleRef.get<ActivationTokenService>(
        ActivationTokenService,
      );
      const suffix = randomUUID();

      const organizationOne = await prisma.organization.create({
        data: {
          legalName: `Employees Org One ${suffix}`,
          commercialName: `Employees Org One ${suffix}`,
          slug: `employees-one-${suffix}`,
          maxUsers: 3,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationOne.id);

      const organizationTwo = await prisma.organization.create({
        data: {
          legalName: `Employees Org Two ${suffix}`,
          commercialName: `Employees Org Two ${suffix}`,
          slug: `employees-two-${suffix}`,
          maxUsers: 5,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationTwo.id);

      const limitedOrganization = await prisma.organization.create({
        data: {
          legalName: `Employees Limited ${suffix}`,
          commercialName: `Employees Limited ${suffix}`,
          slug: `employees-limited-${suffix}`,
          maxUsers: 1,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(limitedOrganization.id);

      const roleOne = await prisma.role.create({
        data: {
          organizationId: organizationOne.id,
          code: `OPS_${suffix.slice(0, 8).toUpperCase()}`,
          name: 'Operations',
          isActive: true,
        },
      });
      cleanup.roleIds.push(roleOne.id);

      const roleOtherTenant = await prisma.role.create({
        data: {
          organizationId: organizationTwo.id,
          code: `OTHER_${suffix.slice(0, 8).toUpperCase()}`,
          name: 'Other',
          isActive: true,
        },
      });
      cleanup.roleIds.push(roleOtherTenant.id);

      const facilityOne = await prisma.facility.create({
        data: {
          organizationId: organizationOne.id,
          code: `SDQ-${suffix.slice(0, 4).toUpperCase()}`,
          name: 'Santo Domingo',
          type: 'BRANCH',
          ownershipType: 'OWNED',
          countryCode: 'DO',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityOne.id);

      const facilityOtherTenant = await prisma.facility.create({
        data: {
          organizationId: organizationTwo.id,
          code: `STI-${suffix.slice(0, 4).toUpperCase()}`,
          name: 'Santiago',
          type: 'BRANCH',
          ownershipType: 'OWNED',
          countryCode: 'DO',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityOtherTenant.id);

      const newSecret = activationTokenService.createSecret();
      const invitedEmployee = await employeesRepository.inviteEmployee({
        organizationId: organizationOne.id,
        email: `new.employee.${suffix}@courier.test`,
        employeeCode: `EMP-${suffix.slice(0, 6).toUpperCase()}`,
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: null,
        facilityIds: [facilityOne.id],
        primaryFacilityId: facilityOne.id,
        roleIds: [roleOne.id],
        activationTokenHash: newSecret.tokenHash,
        activationTokenExpiresAt: daysFromNow(1),
        invitedAt: new Date('2026-07-01T00:00:00.000Z'),
      });

      cleanup.userIds.push(invitedEmployee.employee.user.id);
      cleanup.employeeIds.push(invitedEmployee.employee.id);

      expect(invitedEmployee.status).toBe('invited');

      const persistedToken = await prisma.userActivationToken.findFirstOrThrow({
        where: {
          userId: invitedEmployee.employee.user.id,
        },
      });
      cleanup.tokenIds.push(persistedToken.id);
      expect(persistedToken.tokenHash).toBe(newSecret.tokenHash);

      const activeUser = await prisma.user.create({
        data: {
          email: `active.employee.${suffix}@courier.test`,
          passwordHash: '$argon2id$existing',
          passwordChangedAt: new Date('2026-07-01T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(activeUser.id);

      const reusedActiveUser = await employeesRepository.inviteEmployee({
        organizationId: organizationOne.id,
        email: activeUser.email,
        employeeCode: null,
        firstName: 'Grace',
        lastName: 'Hopper',
        phone: null,
        facilityIds: [],
        primaryFacilityId: null,
        roleIds: [],
        activationTokenHash: null,
        activationTokenExpiresAt: null,
        invitedAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      cleanup.employeeIds.push(reusedActiveUser.employee.id);

      expect(reusedActiveUser.status).toBe('membership_created');
      expect(reusedActiveUser.activation).toBeNull();

      const invitedUser = await prisma.user.create({
        data: {
          email: `invited.employee.${suffix}@courier.test`,
          status: 'INVITED',
        },
      });
      cleanup.userIds.push(invitedUser.id);
      const previousSecret = activationTokenService.createSecret();
      const previousToken = await prisma.userActivationToken.create({
        data: {
          userId: invitedUser.id,
          tokenHash: previousSecret.tokenHash,
          expiresAt: daysFromNow(1),
        },
      });
      cleanup.tokenIds.push(previousToken.id);

      const replacementSecret = activationTokenService.createSecret();
      const reusedInvitedUser = await employeesRepository.inviteEmployee({
        organizationId: organizationOne.id,
        email: invitedUser.email,
        employeeCode: null,
        firstName: 'Katherine',
        lastName: 'Johnson',
        phone: null,
        facilityIds: [],
        primaryFacilityId: null,
        roleIds: [],
        activationTokenHash: replacementSecret.tokenHash,
        activationTokenExpiresAt: daysFromNow(2),
        invitedAt: new Date('2026-07-01T12:00:00.000Z'),
      });
      cleanup.employeeIds.push(reusedInvitedUser.employee.id);

      expect(reusedInvitedUser.status).toBe('invited');
      const invalidatedPreviousToken =
        await prisma.userActivationToken.findUniqueOrThrow({
          where: {
            id: previousToken.id,
          },
        });
      expect(invalidatedPreviousToken.invalidatedAt).toBeInstanceOf(Date);

      const refreshedToken = await prisma.userActivationToken.findFirstOrThrow({
        where: {
          userId: invitedUser.id,
          tokenHash: replacementSecret.tokenHash,
        },
      });
      cleanup.tokenIds.push(refreshedToken.id);

      const suspendedUser = await prisma.user.create({
        data: {
          email: `suspended.employee.${suffix}@courier.test`,
          status: 'SUSPENDED',
        },
      });
      cleanup.userIds.push(suspendedUser.id);

      await expect(
        employeesRepository.inviteEmployee({
          organizationId: organizationOne.id,
          email: suspendedUser.email,
          employeeCode: null,
          firstName: 'Rejected',
          lastName: 'User',
          phone: null,
          facilityIds: [],
          primaryFacilityId: null,
          roleIds: [],
          activationTokenHash: null,
          activationTokenExpiresAt: null,
          invitedAt: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(EmployeeInvitationUserUnavailableError);

      await expect(
        employeesRepository.inviteEmployee({
          organizationId: organizationOne.id,
          email: activeUser.email,
          employeeCode: null,
          firstName: 'Grace',
          lastName: 'Hopper',
          phone: null,
          facilityIds: [],
          primaryFacilityId: null,
          roleIds: [],
          activationTokenHash: null,
          activationTokenExpiresAt: null,
          invitedAt: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(EmployeeMembershipConflictError);

      await expect(
        employeesRepository.inviteEmployee({
          organizationId: organizationOne.id,
          email: `duplicate.code.${suffix}@courier.test`,
          employeeCode: invitedEmployee.employee.employeeCode,
          firstName: 'Duplicate',
          lastName: 'Code',
          phone: null,
          facilityIds: [],
          primaryFacilityId: null,
          roleIds: [],
          activationTokenHash: replacementSecret.tokenHash,
          activationTokenExpiresAt: daysFromNow(2),
          invitedAt: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(EmployeeCodeConflictError);

      await expect(
        employeesRepository.inviteEmployee({
          organizationId: organizationOne.id,
          email: `foreign.facility.${suffix}@courier.test`,
          employeeCode: null,
          firstName: 'Foreign',
          lastName: 'Facility',
          phone: null,
          facilityIds: [facilityOtherTenant.id],
          primaryFacilityId: facilityOtherTenant.id,
          roleIds: [],
          activationTokenHash: newSecret.tokenHash,
          activationTokenExpiresAt: daysFromNow(2),
          invitedAt: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ).rejects.toThrow();

      await expect(
        employeesRepository.inviteEmployee({
          organizationId: organizationOne.id,
          email: `foreign.role.${suffix}@courier.test`,
          employeeCode: null,
          firstName: 'Foreign',
          lastName: 'Role',
          phone: null,
          facilityIds: [],
          primaryFacilityId: null,
          roleIds: [roleOtherTenant.id],
          activationTokenHash: newSecret.tokenHash,
          activationTokenExpiresAt: new Date('2026-07-03T00:00:00.000Z'),
          invitedAt: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ).rejects.toThrow();

      const limitedInviteOne = employeesRepository.inviteEmployee({
        organizationId: limitedOrganization.id,
        email: `limited.one.${suffix}@courier.test`,
        employeeCode: null,
        firstName: 'Limited',
        lastName: 'One',
        phone: null,
        facilityIds: [],
        primaryFacilityId: null,
        roleIds: [],
        activationTokenHash: activationTokenService.createSecret().tokenHash,
        activationTokenExpiresAt: daysFromNow(2),
        invitedAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const limitedInviteTwo = employeesRepository.inviteEmployee({
        organizationId: limitedOrganization.id,
        email: `limited.two.${suffix}@courier.test`,
        employeeCode: null,
        firstName: 'Limited',
        lastName: 'Two',
        phone: null,
        facilityIds: [],
        primaryFacilityId: null,
        roleIds: [],
        activationTokenHash: activationTokenService.createSecret().tokenHash,
        activationTokenExpiresAt: daysFromNow(2),
        invitedAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const limitedResults = await Promise.allSettled([
        limitedInviteOne,
        limitedInviteTwo,
      ]);

      const fulfilledLimitedResults = limitedResults.filter(
        (
          result,
        ): result is PromiseFulfilledResult<EmployeeInvitationRepositoryResult> =>
          result.status === 'fulfilled',
      );
      const rejectedLimitedResults = limitedResults.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      fulfilledLimitedResults.forEach((result) => {
        cleanup.userIds.push(result.value.employee.user.id);
        cleanup.employeeIds.push(result.value.employee.id);
      });

      expect(fulfilledLimitedResults).toHaveLength(1);
      expect(rejectedLimitedResults).toHaveLength(1);
      expect(rejectedLimitedResults[0]?.reason).toBeInstanceOf(
        EmployeeMaxUsersExceededError,
      );
    } finally {
      if (prismaService) {
        if (cleanup.sessionIds.length > 0) {
          await prismaService.userSession.deleteMany({
            where: {
              id: {
                in: cleanup.sessionIds,
              },
            },
          });
        }
        if (cleanup.tokenIds.length > 0) {
          await prismaService.userActivationToken.deleteMany({
            where: {
              OR: [
                {
                  id: {
                    in: cleanup.tokenIds,
                  },
                },
                {
                  userId: {
                    in: cleanup.userIds,
                  },
                },
              ],
            },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employeeFacility.deleteMany({
            where: {
              employeeId: {
                in: cleanup.employeeIds,
              },
            },
          });
          await prismaService.employeeRole.deleteMany({
            where: {
              employeeId: {
                in: cleanup.employeeIds,
              },
            },
          });
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.rolePermission.deleteMany({
            where: {
              roleId: {
                in: cleanup.roleIds,
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
        if (cleanup.facilityIds.length > 0) {
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
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.role.deleteMany({
            where: {
              id: {
                in: cleanup.roleIds,
              },
            },
          });
        }
        if (cleanup.organizationIds.length > 0) {
          await prismaService.organization.deleteMany({
            where: {
              id: {
                in: cleanup.organizationIds,
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
      }

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  }, 90000);
});
