import { Injectable } from '@nestjs/common';

import { changedFields } from '../audit/audit-snapshot';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { OrganizationRegulatoryProfile } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { OrganizationRegulatoryProfileRepository } from './organization-regulatory-profile.repository';
import type {
  OrganizationRegulatoryProfileRecord,
  UpdateOrganizationRegulatoryProfileRecord,
} from './organization-regulatory-profile.types';

@Injectable()
export class PrismaOrganizationRegulatoryProfileRepository extends OrganizationRegulatoryProfileRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findCurrent(
    organizationId: string,
  ): Promise<OrganizationRegulatoryProfileRecord | null> {
    const profile = await this.prisma.organizationRegulatoryProfile.findFirst({
      where: {
        organizationId,
        organization: { deletedAt: null },
      },
    });

    return profile ? this.toRecord(profile) : null;
  }

  async updateCurrent(
    input: UpdateOrganizationRegulatoryProfileRecord,
    context: CommandContext,
  ): Promise<OrganizationRegulatoryProfileRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.organizationRegulatoryProfile.findFirst({
        where: {
          organizationId: input.organizationId,
          organization: { deletedAt: null },
        },
      });
      if (!before) return null;

      const after = await tx.organizationRegulatoryProfile.update({
        where: { organizationId: input.organizationId },
        data: {
          ...(input.fiscalAddress !== undefined
            ? { fiscalAddress: input.fiscalAddress }
            : {}),
          ...(input.authorizedRepresentativeName !== undefined
            ? {
                authorizedRepresentativeName:
                  input.authorizedRepresentativeName,
              }
            : {}),
          ...(input.authorizedRepresentativeEmail !== undefined
            ? {
                authorizedRepresentativeEmail:
                  input.authorizedRepresentativeEmail,
              }
            : {}),
          ...(input.authorizedRepresentativePhone !== undefined
            ? {
                authorizedRepresentativePhone:
                  input.authorizedRepresentativePhone,
              }
            : {}),
          ...(input.courierRegistrationStatus !== undefined
            ? { courierRegistrationStatus: input.courierRegistrationStatus }
            : {}),
          ...(input.dgaOperatorCode !== undefined
            ? { dgaOperatorCode: input.dgaOperatorCode }
            : {}),
          ...(input.electronicInvoicingStatus !== undefined
            ? {
                electronicInvoicingStatus: input.electronicInvoicingStatus,
              }
            : {}),
          declaredAt: input.declaredAt,
        },
      });

      const fields = changedFields(
        this.comparisonSnapshot(before),
        this.comparisonSnapshot(after),
      );
      if (fields.length > 0) {
        await this.auditWriter.write(tx, {
          context,
          action: 'organization.regulatory_profile.updated',
          entityType: 'ORGANIZATION_REGULATORY_PROFILE',
          entityId: input.organizationId,
          changedFields: fields,
          beforeData: this.safeAuditSnapshot(before),
          afterData: this.safeAuditSnapshot(after),
          payload: {
            organizationId: input.organizationId,
            changedFields: fields,
            declarationSource: 'COURIER_ADMIN',
          },
        });
      }

      return this.toRecord(after);
    });
  }

  private comparisonSnapshot(
    profile: OrganizationRegulatoryProfile,
  ): Record<string, unknown> {
    return {
      fiscalAddress: profile.fiscalAddress,
      authorizedRepresentativeName: profile.authorizedRepresentativeName,
      authorizedRepresentativeEmail: profile.authorizedRepresentativeEmail,
      authorizedRepresentativePhone: profile.authorizedRepresentativePhone,
      courierRegistrationStatus: profile.courierRegistrationStatus,
      dgaOperatorCode: profile.dgaOperatorCode,
      electronicInvoicingStatus: profile.electronicInvoicingStatus,
    };
  }

  private safeAuditSnapshot(
    profile: OrganizationRegulatoryProfile,
  ): Record<string, unknown> {
    return {
      fiscalAddressConfigured: Boolean(profile.fiscalAddress),
      authorizedRepresentativeConfigured: Boolean(
        profile.authorizedRepresentativeName,
      ),
      representativeEmailConfigured: Boolean(
        profile.authorizedRepresentativeEmail,
      ),
      representativePhoneConfigured: Boolean(
        profile.authorizedRepresentativePhone,
      ),
      courierRegistrationStatus: profile.courierRegistrationStatus,
      dgaOperatorCodeConfigured: Boolean(profile.dgaOperatorCode),
      electronicInvoicingStatus: profile.electronicInvoicingStatus,
    };
  }

  private toRecord(
    profile: OrganizationRegulatoryProfile,
  ): OrganizationRegulatoryProfileRecord {
    return {
      organizationId: profile.organizationId,
      fiscalAddress: profile.fiscalAddress,
      authorizedRepresentativeName: profile.authorizedRepresentativeName,
      authorizedRepresentativeEmail: profile.authorizedRepresentativeEmail,
      authorizedRepresentativePhone: profile.authorizedRepresentativePhone,
      courierRegistrationStatus: profile.courierRegistrationStatus,
      dgaOperatorCode: profile.dgaOperatorCode,
      electronicInvoicingStatus: profile.electronicInvoicingStatus,
      declaredAt: profile.declaredAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
