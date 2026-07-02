import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prismaService: PrismaService) {}

  async findCurrent(
    organizationId: string,
  ): Promise<OrganizationSettingsCurrentRecord | null> {
    return this.findCurrentWithClient(this.prismaService, organizationId);
  }

  async updateCurrent(
    input: UpdateOrganizationSettingsRecord,
  ): Promise<OrganizationSettingsCurrentRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await tx.organization.findFirst({
        where: {
          id: input.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
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

      return this.findCurrentWithClient(tx, input.organizationId);
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
      await this.prismaService.$transaction([
        this.prismaService.employee.count({
          where: {
            organizationId,
            deletedAt: null,
            status: {
              in: ['PENDING', 'ACTIVE', 'SUSPENDED'],
            },
          },
        }),
        this.prismaService.facility.count({
          where: {
            organizationId,
            deletedAt: null,
          },
        }),
        this.prismaService.customer.count({
          where: {
            organizationId,
            deletedAt: null,
          },
        }),
      ]);

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
      await this.prismaService.$transaction([
        this.prismaService.facility.count({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
          },
        }),
        this.prismaService.employee.count({
          where: {
            organizationId,
            deletedAt: null,
            status: 'ACTIVE',
          },
        }),
        this.prismaService.role.count({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
            rolePermissions: {
              some: {},
            },
          },
        }),
      ]);

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

  async markOnboardingCompleted(organizationId: string): Promise<Date | null> {
    const completedAt = new Date();
    const records =
      await this.prismaService.organizationSettings.updateManyAndReturn({
        where: {
          organizationId,
        },
        data: {
          onboardingCompletedAt: completedAt,
        },
        limit: 1,
      });

    return records[0]?.onboardingCompletedAt ?? null;
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
