import { Injectable } from '@nestjs/common';

import { Prisma, type Facility } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { changedFields } from '../audit/audit-snapshot';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import {
  FacilityCodeConflictError,
  FacilityLimitReachedError,
  FacilityNotFoundError,
  FacilityOrganizationUnavailableError,
} from './facility.errors';
import { FacilitiesRepository } from './facilities.repository';
import type {
  CreateFacilityRecord,
  FacilityListResult,
  FacilityRecord,
  ListFacilitiesRecord,
  UpdateFacilityRecord,
} from './facility.types';

type LockedOrganizationRow = {
  id: string;
  max_facilities: number;
};

@Injectable()
export class PrismaFacilitiesRepository implements FacilitiesRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async create(
    input: CreateFacilityRecord,
    context?: CommandContext,
  ): Promise<FacilityRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const organization = await this.lockOrganization(
          tx,
          input.organizationId,
        );

        if (!organization) {
          throw new FacilityOrganizationUnavailableError(input.organizationId);
        }

        const facilityCount = await tx.facility.count({
          where: {
            organizationId: input.organizationId,
            deletedAt: null,
          },
        });

        if (facilityCount >= organization.max_facilities) {
          throw new FacilityLimitReachedError(organization.max_facilities);
        }

        const facility = await tx.facility.create({
          data: {
            organizationId: input.organizationId,
            code: input.code,
            name: input.name,
            type: input.type,
            ownershipType: input.ownershipType,
            countryCode: input.countryCode,
            province: input.province,
            city: input.city,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            phone: input.phone,
            email: input.email,
            isCustomerFacing: input.isCustomerFacing,
            isPackageOrigin: input.isPackageOrigin,
            isDistributionCenter: input.isDistributionCenter,
            isActive: input.isActive,
          },
        });

        if (context) {
          const snapshot = this.auditSnapshot(facility);
          await this.auditWriter.write(tx, {
            context,
            action: 'facility.created',
            entityType: 'FACILITY',
            entityId: facility.id,
            changedFields: Object.keys(snapshot),
            afterData: snapshot,
            payload: { facilityId: facility.id, code: facility.code },
          });
        }

        return this.toFacilityRecord(facility);
      });
    } catch (error) {
      if (
        error instanceof FacilityLimitReachedError ||
        error instanceof FacilityOrganizationUnavailableError
      ) {
        throw error;
      }

      if (this.isFacilityCodeConflictError(error)) {
        throw new FacilityCodeConflictError(input.code);
      }

      throw error;
    }
  }

  async list(input: ListFacilitiesRecord): Promise<FacilityListResult> {
    const where: Prisma.FacilityWhereInput = {
      organizationId: input.organizationId,
      deletedAt: null,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, facilities] = await this.prismaService.$transaction(
      async (tx) => {
        const totalCount = await tx.facility.count({ where });
        const facilityRows = await tx.facility.findMany({
          where,
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          skip,
          take: input.pageSize,
        });

        return [totalCount, facilityRows] as const;
      },
    );

    return {
      items: facilities.map((facility) => this.toFacilityRecord(facility)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async findById(
    organizationId: string,
    facilityId: string,
  ): Promise<FacilityRecord | null> {
    const facility = await this.prismaService.facility.findFirst({
      where: {
        organizationId,
        id: facilityId,
        deletedAt: null,
      },
    });

    return facility ? this.toFacilityRecord(facility) : null;
  }

  async update(
    input: UpdateFacilityRecord,
    context?: CommandContext,
  ): Promise<FacilityRecord | null> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const before = await tx.facility.findFirst({
          where: {
            organizationId: input.organizationId,
            id: input.facilityId,
            deletedAt: null,
          },
        });
        if (!before) throw new FacilityNotFoundError(input.facilityId);

        const facility = await tx.facility.update({
          where: { id: before.id },
          data: {
            ...(input.code !== undefined ? { code: input.code } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.ownershipType !== undefined
              ? { ownershipType: input.ownershipType }
              : {}),
            ...(input.countryCode !== undefined
              ? { countryCode: input.countryCode }
              : {}),
            ...(input.province !== undefined
              ? { province: input.province }
              : {}),
            ...(input.city !== undefined ? { city: input.city } : {}),
            ...(input.addressLine1 !== undefined
              ? { addressLine1: input.addressLine1 }
              : {}),
            ...(input.addressLine2 !== undefined
              ? { addressLine2: input.addressLine2 }
              : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.isCustomerFacing !== undefined
              ? { isCustomerFacing: input.isCustomerFacing }
              : {}),
            ...(input.isPackageOrigin !== undefined
              ? { isPackageOrigin: input.isPackageOrigin }
              : {}),
            ...(input.isDistributionCenter !== undefined
              ? { isDistributionCenter: input.isDistributionCenter }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
          },
        });
        const beforeSnapshot = this.auditSnapshot(before);
        const afterSnapshot = this.auditSnapshot(facility);
        const fields = changedFields(beforeSnapshot, afterSnapshot);
        if (context && fields.length > 0) {
          await this.auditWriter.write(tx, {
            context,
            action: 'facility.updated',
            entityType: 'FACILITY',
            entityId: facility.id,
            changedFields: fields,
            beforeData: beforeSnapshot,
            afterData: afterSnapshot,
            payload: { facilityId: facility.id, changedFields: fields },
          });
        }
        return this.toFacilityRecord(facility);
      });
    } catch (error) {
      if (error instanceof FacilityNotFoundError) {
        throw error;
      }

      if (this.isFacilityCodeConflictError(error)) {
        throw new FacilityCodeConflictError(input.code ?? 'unknown');
      }

      throw error;
    }
  }

  private auditSnapshot(facility: Facility): Record<string, unknown> {
    return {
      code: facility.code,
      name: facility.name,
      type: facility.type,
      ownershipType: facility.ownershipType,
      countryCode: facility.countryCode,
      isCustomerFacing: facility.isCustomerFacing,
      isPackageOrigin: facility.isPackageOrigin,
      isDistributionCenter: facility.isDistributionCenter,
      isActive: facility.isActive,
    };
  }

  private async lockOrganization(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<LockedOrganizationRow | null> {
    const rows = await tx.$queryRaw<LockedOrganizationRow[]>(Prisma.sql`
      SELECT id, max_facilities
      FROM organizations
      WHERE id = ${organizationId}
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private isFacilityCodeConflictError(error: unknown): boolean {
    if (!this.isKnownRequestError(error) || error.code !== 'P2002') {
      return false;
    }

    if (error.meta?.modelName !== 'Facility') {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.some(
        (entry) =>
          typeof entry === 'string' &&
          (entry.includes('facilities_organization_id_code_key') ||
            entry.includes('organizationId') ||
            entry.includes('code')),
      );
    }

    if (typeof target === 'string') {
      return (
        target.includes('facilities_organization_id_code_key') ||
        target.includes('organizationId') ||
        target.includes('code')
      );
    }

    return true;
  }

  private isKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Error && 'code' in error && 'meta' in error;
  }

  private toFacilityRecord(facility: Facility): FacilityRecord {
    return {
      id: facility.id,
      code: facility.code,
      name: facility.name,
      type: facility.type,
      ownershipType: facility.ownershipType,
      countryCode: facility.countryCode,
      province: facility.province,
      city: facility.city,
      addressLine1: facility.addressLine1,
      addressLine2: facility.addressLine2,
      phone: facility.phone,
      email: facility.email,
      isCustomerFacing: facility.isCustomerFacing,
      isPackageOrigin: facility.isPackageOrigin,
      isDistributionCenter: facility.isDistributionCenter,
      isActive: facility.isActive,
      createdAt: facility.createdAt,
      updatedAt: facility.updatedAt,
    };
  }
}
