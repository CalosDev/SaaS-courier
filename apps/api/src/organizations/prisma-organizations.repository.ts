import { Injectable } from '@nestjs/common';

import type { Organization, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationSlugConflictError } from './organization.errors';
import type {
  CreateOrganizationRecord,
  OrganizationRecord,
} from './organization.types';
import { OrganizationsRepository } from './organizations.repository';

@Injectable()
export class PrismaOrganizationsRepository implements OrganizationsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(input: CreateOrganizationRecord): Promise<OrganizationRecord> {
    try {
      const organization = await this.prismaService.organization.create({
        data: {
          legalName: input.legalName,
          commercialName: input.commercialName,
          slug: input.slug,
          rnc: input.rnc,
          email: input.email,
          phone: input.phone,
        },
      });

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
