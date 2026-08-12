import { Injectable } from '@nestjs/common';

import type { Organization, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { changedFields } from '../audit/audit-snapshot';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import { OrganizationSlugConflictError } from './organization.errors';
import type {
  CreateOrganizationRecord,
  OrganizationRecord,
  UpdateOrganizationProfileRecord,
} from './organization.types';
import { OrganizationsRepository } from './organizations.repository';

@Injectable()
export class PrismaOrganizationsRepository implements OrganizationsRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async create(input: CreateOrganizationRecord): Promise<OrganizationRecord> {
    try {
      const organization = await this.prismaService.$transaction(async (tx) =>
        tx.organization.create({
          data: {
            legalName: input.legalName,
            commercialName: input.commercialName,
            slug: input.slug,
            rnc: input.rnc,
            email: input.email,
            phone: input.phone,
            settings: {
              create: {},
            },
            regulatoryProfile: {
              create: {},
            },
          },
        }),
      );

      return this.toOrganizationRecord(organization);
    } catch (error) {
      if (this.isSlugConflictError(error)) {
        throw new OrganizationSlugConflictError(input.slug);
      }

      throw error;
    }
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    const organization = await this.prismaService.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    return organization ? this.toOrganizationRecord(organization) : null;
  }

  async findBySlug(slug: string): Promise<OrganizationRecord | null> {
    const organization = await this.prismaService.organization.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
    });

    return organization ? this.toOrganizationRecord(organization) : null;
  }

  async updateProfile(
    input: UpdateOrganizationProfileRecord,
    context?: CommandContext,
  ): Promise<OrganizationRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const before = await tx.organization.findFirst({
        where: { id: input.organizationId, deletedAt: null },
      });
      if (!before) return null;

      const organization = await tx.organization.update({
        where: { id: before.id },
        data: {
          ...(input.legalName !== undefined
            ? { legalName: input.legalName }
            : {}),
          ...(input.commercialName !== undefined
            ? { commercialName: input.commercialName }
            : {}),
          ...(input.rnc !== undefined ? { rnc: input.rnc } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });
      const beforeSnapshot = this.profileSnapshot(before);
      const afterSnapshot = this.profileSnapshot(organization);
      const fields = changedFields(beforeSnapshot, afterSnapshot);

      if (context && fields.length > 0) {
        await this.auditWriter.write(tx, {
          context,
          action: 'organization.updated',
          entityType: 'ORGANIZATION',
          entityId: organization.id,
          changedFields: fields,
          beforeData: beforeSnapshot,
          afterData: afterSnapshot,
          payload: { organizationId: organization.id, changedFields: fields },
        });
      }

      return this.toOrganizationRecord(organization);
    });
  }

  private profileSnapshot(organization: Organization): Record<string, unknown> {
    return {
      legalName: organization.legalName,
      commercialName: organization.commercialName,
      countryCode: organization.countryCode,
      currencyCode: organization.currencyCode,
      timezone: organization.timezone,
      status: organization.status,
    };
  }

  private isSlugConflictError(error: unknown): boolean {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    const target = prismaError.meta?.target;
    const modelName = prismaError.meta?.modelName;

    if (modelName !== 'Organization') {
      return false;
    }

    if (Array.isArray(target)) {
      return target.some(
        (entry) =>
          typeof entry === 'string' &&
          (entry.includes('slug') || entry.includes('organizations_slug_key')),
      );
    }

    if (typeof target === 'string') {
      return (
        target.includes('slug') || target.includes('organizations_slug_key')
      );
    }

    return true;
  }

  private toOrganizationRecord(organization: Organization): OrganizationRecord {
    return {
      id: organization.id,
      legalName: organization.legalName,
      commercialName: organization.commercialName,
      slug: organization.slug,
      rnc: organization.rnc,
      email: organization.email,
      phone: organization.phone,
      countryCode: organization.countryCode,
      currencyCode: organization.currencyCode,
      timezone: organization.timezone,
      status: organization.status,
      planCode: organization.planCode,
      maxUsers: organization.maxUsers,
      maxFacilities: organization.maxFacilities,
      trialEndsAt: organization.trialEndsAt,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      deletedAt: organization.deletedAt,
    };
  }
}
