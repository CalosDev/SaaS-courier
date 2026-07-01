import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type CustomerCustomsProfile,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerIdentityConflictError,
  CustomerNotFoundError,
} from './customer.errors';
import { CustomerCustomsProfilesRepository } from './customer-customs-profiles.repository';
import type {
  CustomerCustomsProfileRecord,
  UpdateCustomerCustomsVerificationRecord,
  UpsertCustomerCustomsProfileIdentityRecord,
} from './customer.types';

type LockedCustomerRow = {
  id: string;
};

@Injectable()
export class PrismaCustomerCustomsProfilesRepository implements CustomerCustomsProfilesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerCustomsProfileRecord | null> {
    const profile = await this.prismaService.customerCustomsProfile.findFirst({
      where: {
        organizationId,
        customerId,
      },
    });

    return profile ? this.toRecord(profile) : null;
  }

  async upsertIdentity(
    input: UpsertCustomerCustomsProfileIdentityRecord,
  ): Promise<CustomerCustomsProfileRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const customer = await this.lockCustomer(
          tx,
          input.organizationId,
          input.customerId,
        );

        if (!customer) {
          throw new CustomerNotFoundError(input.customerId);
        }

        const currentProfile = await tx.customerCustomsProfile.findUnique({
          where: {
            organizationId_customerId: {
              organizationId: input.organizationId,
              customerId: input.customerId,
            },
          },
        });

        const profile = currentProfile
          ? await tx.customerCustomsProfile.update({
              where: {
                organizationId_customerId: {
                  organizationId: input.organizationId,
                  customerId: input.customerId,
                },
              },
              data: {
                documentType: input.documentType,
                documentNumber: input.documentNumber,
                ruaStatus: input.ruaStatus,
                verificationSource: input.verificationSource,
                lastCheckedAt: input.lastCheckedAt,
                verifiedAt: input.verifiedAt,
                externalReference: input.externalReference,
                ...(input.notes !== undefined ? { notes: input.notes } : {}),
              },
            })
          : await tx.customerCustomsProfile.create({
              data: {
                organizationId: input.organizationId,
                customerId: input.customerId,
                documentType: input.documentType,
                documentNumber: input.documentNumber,
                ruaStatus: input.ruaStatus,
                verificationSource: input.verificationSource,
                lastCheckedAt: input.lastCheckedAt,
                verifiedAt: input.verifiedAt,
                externalReference: input.externalReference,
                notes: input.notes ?? null,
              },
            });

        return this.toRecord(profile);
      });
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw error;
      }

      if (this.isIdentityConflictError(error)) {
        throw new CustomerIdentityConflictError(
          input.documentType,
          input.documentNumber,
        );
      }

      throw error;
    }
  }

  async updateVerification(
    input: UpdateCustomerCustomsVerificationRecord,
  ): Promise<CustomerCustomsProfileRecord | null> {
    const updatedProfiles =
      await this.prismaService.customerCustomsProfile.updateManyAndReturn({
        where: {
          organizationId: input.organizationId,
          customerId: input.customerId,
        },
        data: {
          ruaStatus: input.ruaStatus,
          verificationSource: input.verificationSource,
          lastCheckedAt: input.lastCheckedAt,
          verifiedAt: input.verifiedAt,
          externalReference: input.externalReference,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        limit: 1,
      });

    const profile = updatedProfiles[0];

    return profile ? this.toRecord(profile) : null;
  }

  private async lockCustomer(
    tx: Prisma.TransactionClient,
    organizationId: string,
    customerId: string,
  ): Promise<LockedCustomerRow | null> {
    const rows = await tx.$queryRaw<LockedCustomerRow[]>(Prisma.sql`
      SELECT id
      FROM customers
      WHERE organization_id = ${organizationId}
        AND id = ${customerId}
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private isIdentityConflictError(error: unknown): boolean {
    if (!this.isKnownRequestError(error) || error.code !== 'P2002') {
      return false;
    }

    if (error.meta?.modelName !== 'CustomerCustomsProfile') {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.some(
        (entry) =>
          typeof entry === 'string' &&
          (entry.includes('customer_customs_profiles_org_doc_key') ||
            entry.includes('documentNumber') ||
            entry.includes('documentType')),
      );
    }

    if (typeof target === 'string') {
      return (
        target.includes('customer_customs_profiles_org_doc_key') ||
        target.includes('documentNumber') ||
        target.includes('documentType')
      );
    }

    return true;
  }

  private isKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Error && 'code' in error && 'meta' in error;
  }

  private toRecord(
    profile: CustomerCustomsProfile,
  ): CustomerCustomsProfileRecord {
    return {
      id: profile.id,
      customerId: profile.customerId,
      documentType: profile.documentType,
      documentNumber: profile.documentNumber,
      ruaStatus: profile.ruaStatus,
      verificationSource: profile.verificationSource,
      lastCheckedAt: profile.lastCheckedAt,
      verifiedAt: profile.verifiedAt,
      externalReference: profile.externalReference,
      notes: profile.notes,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
