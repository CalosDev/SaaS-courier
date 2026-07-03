import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { changedFields } from '../audit/audit-snapshot';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import { OrganizationSettingsRepository } from './organization-settings.repository';
import type {
  OnboardingSnapshot,
  OrganizationCapabilitiesSnapshot,
  OrganizationSettingsCurrentRecord,
  OrganizationSettingsRecord,
  UpdateOrganizationSettingsRecord,
} from './organization-settings.types';

@Injectable()
export class PrismaOrganizationSettingsRepository implements OrganizationSettingsRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async findCurrent(
    organizationId: string,
  ): Promise<OrganizationSettingsCurrentRecord | null> {
    return this.findCurrentWithClient(this.prismaService, organizationId);
  }

  async updateCurrent(
    input: UpdateOrganizationSettingsRecord,
    context?: CommandContext,
  ): Promise<OrganizationSettingsCurrentRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const before = await this.findCurrentWithClient(tx, input.organizationId);

      if (!before) {
        return null;
      }

      await tx.organization.update({
        where: {
          id: input.organizationId,
        },
        data: {
          ...(input.countryCode !== undefined
            ? { countryCode: input.countryCode }
            : {}),
          ...(input.currencyCode !== undefined
            ? { currencyCode: input.currencyCode }
            : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        },
      });

      await tx.organizationSettings.update({
        where: {
          organizationId: input.organizationId,
        },
        data: {
          ...(input.locale !== undefined ? { locale: input.locale } : {}),
          ...(input.dateFormat !== undefined
            ? { dateFormat: input.dateFormat }
            : {}),
          ...(input.weightUnit !== undefined
            ? { weightUnit: input.weightUnit }
            : {}),
          ...(input.dimensionUnit !== undefined
            ? { dimensionUnit: input.dimensionUnit }
            : {}),
          ...(input.customerCodeStrategy !== undefined
            ? { customerCodeStrategy: input.customerCodeStrategy }
            : {}),
          ...(input.customerCodePrefix !== undefined
            ? { customerCodePrefix: input.customerCodePrefix }
            : {}),
          ...(input.customerCodeRandomLength !== undefined
            ? { customerCodeRandomLength: input.customerCodeRandomLength }
            : {}),
          ...(input.customerCodeSequencePadding !== undefined
            ? { customerCodeSequencePadding: input.customerCodeSequencePadding }
            : {}),
        },
      });

      const updated = await this.findCurrentWithClient(
        tx,
        input.organizationId,
      );
      if (!updated) return null;

      const beforeSnapshot = this.auditSnapshot(before);
      const afterSnapshot = this.auditSnapshot(updated);
      const fields = changedFields(beforeSnapshot, afterSnapshot);
      if (context && fields.length > 0) {
        await this.auditWriter.write(tx, {
          context,
          action: 'organization.settings.updated',
          entityType: 'ORGANIZATION_SETTINGS',
          entityId: input.organizationId,
          changedFields: fields,
          beforeData: beforeSnapshot,
          afterData: afterSnapshot,
          payload: {
            organizationId: input.organizationId,
            changedFields: fields,
          },
        });
      }
      return updated;
    });
  }

  async getCapabilitiesSnapshot(
    organizationId: string,
  ): Promise<OrganizationCapabilitiesSnapshot | null> {
    const organization = await this.prismaService.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        planCode: true,
        maxUsers: true,
        maxFacilities: true,
      },
    });

    if (!organization) {
      return null;
    }

    const [users, facilities, customers] =
      await this.prismaService.$transaction(async (tx) => {
        const employeeCount = await tx.employee.count({
          where: {
            organizationId,
            deletedAt: null,
            status: {
              in: ['PENDING', 'ACTIVE', 'SUSPENDED'],
            },
          },
        });
        const facilityCount = await tx.facility.count({
          where: {
            organizationId,
            deletedAt: null,
          },
        });
        const customerCount = await tx.customer.count({
          where: {
            organizationId,
            deletedAt: null,
          },
        });

        return [employeeCount, facilityCount, customerCount] as const;
      });

    return {
      organization,
      usage: {
        users,
        facilities,
        customers,
      },
    };
  }

  async getOnboardingSnapshot(
    organizationId: string,
  ): Promise<OnboardingSnapshot | null> {
    const current = await this.findCurrent(organizationId);

    if (!current) {
      return null;
    }

    const [activeFacilities, activeEmployees, activeRolesWithPermissions] =
      await this.prismaService.$transaction(async (tx) => {
        const facilityCount = await tx.facility.count({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
          },
        });
        const employeeCount = await tx.employee.count({
          where: {
            organizationId,
            deletedAt: null,
            status: 'ACTIVE',
          },
        });
        const roleCount = await tx.role.count({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
            rolePermissions: {
              some: {},
            },
          },
        });

        return [facilityCount, employeeCount, roleCount] as const;
      });

    return {
      organizationProfileCompleted:
        current.organization.id.length > 0 &&
        current.organization.countryCode.length === 2 &&
        current.organization.currencyCode.length === 3 &&
        current.organization.timezone.length > 0,
      operationalSettingsCompleted: current.settings.locale.length > 0,
      customerCodePolicyCompleted:
        current.settings.customerCodePrefix.length > 0 &&
        current.settings.customerCodeRandomLength >= 4 &&
        current.settings.customerCodeSequencePadding >= 3,
      activeFacilities,
      activeEmployees,
      activeRolesWithPermissions,
      onboardingCompletedAt: current.settings.onboardingCompletedAt,
    };
  }

  async markOnboardingCompleted(
    organizationId: string,
    context?: CommandContext,
  ): Promise<Date | null> {
    return this.prismaService.$transaction(async (tx) => {
      const before = await tx.organizationSettings.findUnique({
        where: { organizationId },
      });
      if (!before) return null;
      if (before.onboardingCompletedAt) return before.onboardingCompletedAt;

      const completedAt = new Date();
      const updated = await tx.organizationSettings.update({
        where: { organizationId },
        data: { onboardingCompletedAt: completedAt },
      });
      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'organization.onboarding.completed',
          entityType: 'ORGANIZATION_SETTINGS',
          entityId: organizationId,
          changedFields: ['onboardingCompletedAt'],
          beforeData: { onboardingCompleted: false },
          afterData: { onboardingCompleted: true },
          payload: { organizationId, onboardingCompleted: true },
        });
      }
      return updated.onboardingCompletedAt;
    });
  }

  private auditSnapshot(
    record: OrganizationSettingsCurrentRecord,
  ): Record<string, unknown> {
    return {
      countryCode: record.organization.countryCode,
      currencyCode: record.organization.currencyCode,
      timezone: record.organization.timezone,
      locale: record.settings.locale,
      dateFormat: record.settings.dateFormat,
      weightUnit: record.settings.weightUnit,
      dimensionUnit: record.settings.dimensionUnit,
      customerCodeStrategy: record.settings.customerCodeStrategy,
      customerCodePrefix: record.settings.customerCodePrefix,
      customerCodeRandomLength: record.settings.customerCodeRandomLength,
      customerCodeSequencePadding: record.settings.customerCodeSequencePadding,
    };
  }

  private async findCurrentWithClient(
    prisma: PrismaService | Prisma.TransactionClient,
    organizationId: string,
  ): Promise<OrganizationSettingsCurrentRecord | null> {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        settings: true,
      },
    });

    if (!organization?.settings) {
      return null;
    }

    return {
      organization: {
        id: organization.id,
        planCode: organization.planCode,
        maxUsers: organization.maxUsers,
        maxFacilities: organization.maxFacilities,
        countryCode: organization.countryCode,
        currencyCode: organization.currencyCode,
        timezone: organization.timezone,
      },
      settings: this.toSettingsRecord(organization.settings),
    };
  }

  private toSettingsRecord(
    settings: Awaited<
      ReturnType<PrismaService['organizationSettings']['findFirstOrThrow']>
    >,
  ): OrganizationSettingsRecord {
    return {
      locale: settings.locale,
      dateFormat: settings.dateFormat,
      weightUnit: settings.weightUnit,
      dimensionUnit: settings.dimensionUnit,
      customerCodeStrategy: settings.customerCodeStrategy,
      customerCodePrefix: settings.customerCodePrefix,
      customerCodeRandomLength: settings.customerCodeRandomLength,
      customerCodeSequencePadding: settings.customerCodeSequencePadding,
      nextCustomerSequence: Number(settings.nextCustomerSequence),
      onboardingCompletedAt: settings.onboardingCompletedAt,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}
