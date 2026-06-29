import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginLockoutPolicy } from './login-lockout.policy';
import { AuthRepository } from './auth.repository';
import type {
  AuthenticationMembership,
  AuthenticationUserRecord,
  FailedAuthenticationState,
  OrganizationContext,
  RegisterFailedAuthenticationAttemptInput,
  RegisterSuccessfulAuthenticationInput,
  SuccessfulAuthenticationState,
} from './auth.types';

type LockedUserRow = {
  id: string;
  failed_login_attempts: number;
  locked_until: Date | null;
};

type EmployeeMembershipRecord = {
  id: string;
  organizationId: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  organization: {
    id: string;
    slug: string;
    commercialName: string;
    status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  };
  employeeFacilities: Array<{
    facilityId: string;
    isPrimary: boolean;
  }>;
};

type OrganizationContextRecord = {
  id: string;
  organizationId: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  organization: {
    id: string;
    slug: string;
    commercialName: string;
  };
  user: {
    id: string;
    email: string;
  };
  employeeFacilities: Array<{
    facilityId: string;
    isPrimary: boolean;
  }>;
};

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loginLockoutPolicy: LoginLockoutPolicy,
  ) {}

  async findUserByEmail(
    email: string,
  ): Promise<AuthenticationUserRecord | null> {
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        emailVerifiedAt: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        deletedAt: true,
      },
    });

    return user ? this.toAuthenticationUserRecord(user) : null;
  }

  async registerFailedAuthenticationAttempt(
    input: RegisterFailedAuthenticationAttemptInput,
  ): Promise<FailedAuthenticationState | null> {
    return this.prismaService.$transaction(async (tx) => {
      const lockedUsers = await tx.$queryRaw<LockedUserRow[]>(Prisma.sql`
        SELECT id, failed_login_attempts, locked_until
        FROM users
        WHERE id = ${input.userId}::uuid
        FOR UPDATE
      `);
      const lockedUser = lockedUsers[0];

      if (!lockedUser) {
        return null;
      }

      const nextState = this.loginLockoutPolicy.calculateNextFailureState({
        currentFailedLoginAttempts: lockedUser.failed_login_attempts,
        currentLockedUntil: lockedUser.locked_until,
        occurredAt: input.occurredAt,
      });

      await tx.user.update({
        where: {
          id: input.userId,
        },
        data: {
          failedLoginAttempts: nextState.failedLoginAttempts,
          lockedUntil: nextState.lockedUntil,
        },
      });

      return nextState;
    });
  }

  async registerSuccessfulAuthentication(
    input: RegisterSuccessfulAuthenticationInput,
  ): Promise<SuccessfulAuthenticationState | null> {
    return this.prismaService.$transaction(async (tx) => {
      const lockedUsers = await tx.$queryRaw<LockedUserRow[]>(Prisma.sql`
        SELECT id, failed_login_attempts, locked_until
        FROM users
        WHERE id = ${input.userId}::uuid
        FOR UPDATE
      `);
      const lockedUser = lockedUsers[0];

      if (!lockedUser) {
        return null;
      }

      if (
        this.loginLockoutPolicy.isLocked(
          lockedUser.locked_until,
          input.authenticatedAt,
        )
      ) {
        return {
          blocked: true,
          lockedUntil: lockedUser.locked_until,
        };
      }

      await tx.user.update({
        where: {
          id: input.userId,
        },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: input.authenticatedAt,
        },
      });

      return {
        blocked: false,
        lockedUntil: null,
      };
    });
  }

  async findAvailableOrganizationsForUser(
    userId: string,
  ): Promise<AuthenticationMembership[]> {
    const employees = await this.prismaService.employee.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        user: {
          status: 'ACTIVE',
          deletedAt: null,
        },
        organization: {
          status: {
            in: ['ACTIVE', 'TRIAL'],
          },
          deletedAt: null,
        },
      },
      select: {
        id: true,
        organizationId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        organization: {
          select: {
            id: true,
            slug: true,
            commercialName: true,
            status: true,
          },
        },
        employeeFacilities: {
          where: {
            facility: {
              isActive: true,
              deletedAt: null,
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { facilityId: 'asc' }],
          select: {
            facilityId: true,
            isPrimary: true,
          },
        },
      },
      orderBy: [
        {
          organization: {
            commercialName: 'asc',
          },
        },
        {
          id: 'asc',
        },
      ],
    });

    return employees.map((employee) =>
      this.toAuthenticationMembership(employee),
    );
  }

  async findOrganizationContext(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationContext | null> {
    const employee = await this.prismaService.employee.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        user: {
          status: 'ACTIVE',
          deletedAt: null,
        },
        organization: {
          status: {
            in: ['ACTIVE', 'TRIAL'],
          },
          deletedAt: null,
        },
      },
      select: {
        id: true,
        organizationId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            slug: true,
            commercialName: true,
          },
        },
        employeeFacilities: {
          where: {
            facility: {
              isActive: true,
              deletedAt: null,
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { facilityId: 'asc' }],
          select: {
            facilityId: true,
            isPrimary: true,
          },
        },
      },
    });

    if (!employee) {
      return null;
    }

    return this.toOrganizationContext(employee);
  }

  private toAuthenticationUserRecord(user: {
    id: string;
    email: string;
    passwordHash: string | null;
    emailVerifiedAt: Date | null;
    status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    deletedAt: Date | null;
  }): AuthenticationUserRecord {
    return {
      userId: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      emailVerifiedAt: user.emailVerifiedAt,
      status: user.status,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      deletedAt: user.deletedAt,
    };
  }

  private toAuthenticationMembership(
    employee: EmployeeMembershipRecord,
  ): AuthenticationMembership {
    const primaryFacilityId = employee.employeeFacilities.find(
      (facility) => facility.isPrimary,
    )?.facilityId;
    const membership: AuthenticationMembership = {
      organizationId: employee.organization.id,
      organizationSlug: employee.organization.slug,
      organizationName: employee.organization.commercialName,
      organizationStatus: employee.organization.status,
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      facilityIds: employee.employeeFacilities.map(
        (facility) => facility.facilityId,
      ),
    };

    if (employee.employeeCode) {
      membership.employeeCode = employee.employeeCode;
    }

    if (primaryFacilityId) {
      membership.primaryFacilityId = primaryFacilityId;
    }

    return membership;
  }

  private toOrganizationContext(
    employee: OrganizationContextRecord,
  ): OrganizationContext {
    const primaryFacilityId = employee.employeeFacilities.find(
      (facility) => facility.isPrimary,
    )?.facilityId;
    const context: OrganizationContext = {
      userId: employee.user.id,
      email: employee.user.email,
      organizationId: employee.organization.id,
      organizationSlug: employee.organization.slug,
      organizationName: employee.organization.commercialName,
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      facilityIds: employee.employeeFacilities.map(
        (facility) => facility.facilityId,
      ),
    };

    if (employee.employeeCode) {
      context.employeeCode = employee.employeeCode;
    }

    if (primaryFacilityId) {
      context.primaryFacilityId = primaryFacilityId;
    }

    return context;
  }
}
