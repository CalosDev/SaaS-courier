import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsRepository } from './sessions.repository';
import type {
  CreateSessionRecordInput,
  RevokeAllUserSessionsRecordInput,
  RevokeEmployeeSessionsRecordInput,
  RevokeSessionRecordInput,
  RotateSessionRecordInput,
  SessionContext,
  SessionPrincipalContext,
  SessionRevocationReason,
  SessionRotationRecord,
  SessionValidationRecord,
  ValidateSessionRecordInput,
} from './session.types';

type LockedSessionRow = {
  id: string;
  family_id: string;
  organization_id: string;
  employee_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  revocation_reason: SessionRevocationReason | null;
  last_seen_at: Date | null;
  created_at: Date;
};

type EmployeePrincipalRecord = {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  user: {
    id: string;
    email: string;
  };
  organization: {
    id: string;
    slug: string;
    commercialName: string;
  };
  employeeFacilities: Array<{
    facilityId: string;
    isPrimary: boolean;
  }>;
};

type EmployeePrincipalRow = {
  id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  user_id: string;
  user_email: string;
  organization_id: string;
  organization_slug: string;
  organization_commercial_name: string;
};

type EmployeeFacilityRow = {
  facility_id: string;
  is_primary: boolean;
};

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findSessionCreationContext(
    userId: string,
    organizationId: string,
  ): Promise<SessionPrincipalContext | null> {
    const employee = await this.findEligibleEmployee(this.prismaService, {
      userId,
      organizationId,
    });

    return employee ? this.toSessionPrincipalContext(employee) : null;
  }

  async createSessionRecord(
    input: CreateSessionRecordInput,
  ): Promise<SessionContext> {
    await this.prismaService.userSession.create({
      data: {
        id: input.sessionId,
        familyId: input.familyId,
        organizationId: input.principal.organizationId,
        employeeId: input.principal.employeeId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        lastSeenAt: input.lastSeenAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return {
      sessionId: input.sessionId,
      expiresAt: input.expiresAt,
      ...input.principal,
    };
  }

  async validateSessionRecord(
    input: ValidateSessionRecordInput,
  ): Promise<SessionValidationRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const session = await this.findLockedSessionByTokenHash(
        tx,
        input.tokenHash,
      );

      if (!session) {
        return { status: 'invalid' };
      }

      if (session.revocation_reason === 'ROTATED') {
        await this.revokeActiveFamilySessions(
          tx,
          session.family_id,
          input.evaluatedAt,
          'REUSE_DETECTED',
        );

        return { status: 'reuse-detected' };
      }

      if (
        session.revoked_at !== null ||
        session.expires_at <= input.evaluatedAt
      ) {
        return { status: 'invalid' };
      }

      const lastActivityAt = session.last_seen_at ?? session.created_at;

      if (lastActivityAt < input.idleExpiresBefore) {
        await this.revokeSessionById(
          tx,
          session.id,
          input.evaluatedAt,
          'IDLE_TIMEOUT',
        );
        return { status: 'invalid' };
      }

      const principal = await this.findEligibleEmployee(tx, {
        employeeId: session.employee_id,
        organizationId: session.organization_id,
      });

      if (!principal) {
        return { status: 'invalid' };
      }

      if (lastActivityAt <= input.refreshLastSeenBefore) {
        await tx.userSession.update({
          where: {
            id: session.id,
          },
          data: {
            lastSeenAt: input.evaluatedAt,
          },
        });
      }

      return {
        status: 'valid',
        session: {
          sessionId: session.id,
          expiresAt: session.expires_at,
          ...this.toSessionPrincipalContext(principal),
        },
      };
    });
  }

  async rotateSessionRecord(
    input: RotateSessionRecordInput,
  ): Promise<SessionRotationRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const session = await this.findLockedSessionByTokenHash(
        tx,
        input.currentTokenHash,
      );

      if (!session) {
        return { status: 'invalid' };
      }

      if (session.revocation_reason === 'ROTATED') {
        await this.revokeActiveFamilySessions(
          tx,
          session.family_id,
          input.rotatedAt,
          'REUSE_DETECTED',
        );

        return { status: 'reuse-detected' };
      }

      if (
        session.revoked_at !== null ||
        session.expires_at <= input.rotatedAt
      ) {
        return { status: 'invalid' };
      }

      const lastActivityAt = session.last_seen_at ?? session.created_at;

      if (lastActivityAt < input.idleExpiresBefore) {
        await this.revokeSessionById(
          tx,
          session.id,
          input.rotatedAt,
          'IDLE_TIMEOUT',
        );
        return { status: 'invalid' };
      }

      const principal = await this.findEligibleEmployee(tx, {
        employeeId: session.employee_id,
        organizationId: session.organization_id,
      });

      if (!principal) {
        return { status: 'invalid' };
      }

      await tx.userSession.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: input.rotatedAt,
          revocationReason: 'ROTATED',
        },
      });

      await tx.userSession.create({
        data: {
          id: input.newSessionId,
          familyId: session.family_id,
          organizationId: session.organization_id,
          employeeId: session.employee_id,
          tokenHash: input.newTokenHash,
          expiresAt: session.expires_at,
          lastSeenAt: input.rotatedAt,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          rotatedFromSessionId: session.id,
        },
      });

      return {
        status: 'rotated',
        session: {
          sessionId: input.newSessionId,
          expiresAt: session.expires_at,
          ...this.toSessionPrincipalContext(principal),
        },
      };
    });
  }

  async revokeSessionRecord(input: RevokeSessionRecordInput): Promise<void> {
    await this.prismaService.userSession.updateMany({
      where: {
        tokenHash: input.tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: input.revokedAt,
        },
      },
      data: {
        revokedAt: input.revokedAt,
        revocationReason: input.reason,
      },
    });
  }

  async revokeAllUserSessionsRecord(
    input: RevokeAllUserSessionsRecordInput,
  ): Promise<number> {
    const result = await this.prismaService.userSession.updateMany({
      where: {
        revokedAt: null,
        employee: {
          userId: input.userId,
        },
      },
      data: {
        revokedAt: input.revokedAt,
        revocationReason: input.reason,
      },
    });

    return result.count;
  }

  async revokeEmployeeSessionsRecord(
    input: RevokeEmployeeSessionsRecordInput,
  ): Promise<number> {
    const result = await this.prismaService.userSession.updateMany({
      where: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        revokedAt: null,
        expiresAt: {
          gt: input.revokedAt,
        },
      },
      data: {
        revokedAt: input.revokedAt,
        revocationReason: input.reason,
      },
    });

    return result.count;
  }

  private async findLockedSessionByTokenHash(
    tx: Prisma.TransactionClient,
    tokenHash: string,
  ): Promise<LockedSessionRow | null> {
    const rows = await tx.$queryRaw<LockedSessionRow[]>(Prisma.sql`
      SELECT
        id,
        family_id,
        organization_id,
        employee_id,
        expires_at,
        revoked_at,
        revocation_reason,
        last_seen_at,
        created_at
      FROM user_sessions
      WHERE token_hash = ${tokenHash}
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async revokeActiveFamilySessions(
    tx: Prisma.TransactionClient,
    familyId: string,
    revokedAt: Date,
    reason: Extract<SessionRevocationReason, 'REUSE_DETECTED'>,
  ): Promise<void> {
    await tx.userSession.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt,
        revocationReason: reason,
      },
    });
  }

  private async revokeSessionById(
    tx: Prisma.TransactionClient,
    sessionId: string,
    revokedAt: Date,
    reason: Extract<SessionRevocationReason, 'IDLE_TIMEOUT'>,
  ): Promise<void> {
    await tx.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        revokedAt,
        revocationReason: reason,
      },
    });
  }

  private async findEligibleEmployee(
    prisma: PrismaService | Prisma.TransactionClient,
    input:
      | {
          userId: string;
          organizationId: string;
          employeeId?: never;
        }
      | {
          employeeId: string;
          organizationId: string;
          userId?: never;
        },
  ): Promise<EmployeePrincipalRecord | null> {
    const employeeRows = await prisma.$queryRaw<EmployeePrincipalRow[]>(
      Prisma.sql`
        SELECT
          e.id,
          e.employee_code,
          e.first_name,
          e.last_name,
          u.id AS user_id,
          u.email AS user_email,
          o.id AS organization_id,
          o.slug AS organization_slug,
          o.commercial_name AS organization_commercial_name
        FROM employees e
        INNER JOIN users u
          ON u.id = e.user_id
        INNER JOIN organizations o
          ON o.id = e.organization_id
        WHERE e.organization_id = ${input.organizationId}::uuid
          AND e.status = 'ACTIVE'::employee_status
          AND e.deleted_at IS NULL
          AND u.status = 'ACTIVE'::user_status
          AND u.deleted_at IS NULL
          AND u.email_verified_at IS NOT NULL
          AND u.password_hash IS NOT NULL
          AND o.status IN ('ACTIVE'::organization_status, 'TRIAL'::organization_status)
          AND o.deleted_at IS NULL
          AND ${
            'employeeId' in input
              ? Prisma.sql`e.id = ${input.employeeId}::uuid`
              : Prisma.sql`e.user_id = ${input.userId}::uuid`
          }
        LIMIT 1
      `,
    );
    const employee = employeeRows[0];

    if (!employee) {
      return null;
    }

    const facilityRows = await prisma.$queryRaw<EmployeeFacilityRow[]>(
      Prisma.sql`
        SELECT
          ef.facility_id,
          ef.is_primary
        FROM employee_facilities ef
        INNER JOIN facilities f
          ON f.organization_id = ef.organization_id
         AND f.id = ef.facility_id
        WHERE ef.organization_id = ${input.organizationId}::uuid
          AND ef.employee_id = ${employee.id}::uuid
          AND f.is_active = TRUE
          AND f.deleted_at IS NULL
        ORDER BY ef.is_primary DESC, ef.facility_id ASC
      `,
    );

    return {
      id: employee.id,
      employeeCode: employee.employee_code,
      firstName: employee.first_name,
      lastName: employee.last_name,
      user: {
        id: employee.user_id,
        email: employee.user_email,
      },
      organization: {
        id: employee.organization_id,
        slug: employee.organization_slug,
        commercialName: employee.organization_commercial_name,
      },
      employeeFacilities: facilityRows.map((facility) => ({
        facilityId: facility.facility_id,
        isPrimary: facility.is_primary,
      })),
    };
  }

  private toSessionPrincipalContext(
    employee: EmployeePrincipalRecord,
  ): SessionPrincipalContext {
    const primaryFacilityId = employee.employeeFacilities.find(
      (facility) => facility.isPrimary,
    )?.facilityId;
    const context: SessionPrincipalContext = {
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
