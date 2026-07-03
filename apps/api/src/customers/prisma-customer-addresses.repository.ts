import { Injectable } from '@nestjs/common';
import { changedFields } from '../audit/audit-snapshot';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { Prisma, type CustomerAddress } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  CustomerAddressNotFoundError,
  CustomerNotFoundError,
} from './customer.errors';
import { CustomerAddressesRepository } from './customer-addresses.repository';
import type {
  CreateCustomerAddressRecord,
  CustomerAddressRecord,
  UpdateCustomerAddressRecord,
} from './customer.types';

type LockedCustomerRow = {
  id: string;
};

@Injectable()
export class PrismaCustomerAddressesRepository implements CustomerAddressesRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async listByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerAddressRecord[]> {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        organizationId,
        id: customerId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    const addresses = await this.prismaService.customerAddress.findMany({
      where: {
        organizationId,
        customerId,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: 'desc' }, { type: 'asc' }, { createdAt: 'asc' }],
    });

    return addresses.map((address) => this.toCustomerAddressRecord(address));
  }

  async create(
    input: CreateCustomerAddressRecord,
    context?: CommandContext,
  ): Promise<CustomerAddressRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const customer = await this.lockCustomer(
        tx,
        input.organizationId,
        input.customerId,
      );

      if (!customer) {
        throw new CustomerNotFoundError(input.customerId);
      }

      if (input.isPrimary) {
        await tx.customerAddress.updateMany({
          where: {
            organizationId: input.organizationId,
            customerId: input.customerId,
            type: input.type,
            deletedAt: null,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const address = await tx.customerAddress.create({
        data: {
          organizationId: input.organizationId,
          customerId: input.customerId,
          type: input.type,
          label: input.label,
          recipientName: input.recipientName,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          province: input.province,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          isPrimary: input.isPrimary,
          isActive: input.isActive,
        },
      });

      const addressRecord = this.toCustomerAddressRecord(address);

      if (context) {
        const afterData = this.addressAuditSnapshot(addressRecord);
        await this.auditWriter.write(tx, {
          context,
          action: 'customer.address.created',
          entityType: 'CUSTOMER_ADDRESS',
          entityId: addressRecord.id,
          changedFields: Object.keys(afterData),
          afterData,
          payload: {
            customerId: input.customerId,
            addressId: addressRecord.id,
            type: addressRecord.type,
          },
        });
      }

      return addressRecord;
    });
  }

  async update(
    input: UpdateCustomerAddressRecord,
    context?: CommandContext,
  ): Promise<CustomerAddressRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const customer = await this.lockCustomer(
        tx,
        input.organizationId,
        input.customerId,
      );

      if (!customer) {
        throw new CustomerNotFoundError(input.customerId);
      }

      const currentAddress = await tx.customerAddress.findFirst({
        where: {
          organizationId: input.organizationId,
          customerId: input.customerId,
          id: input.addressId,
          deletedAt: null,
        },
      });

      if (!currentAddress) {
        throw new CustomerAddressNotFoundError(input.addressId);
      }

      const targetType = input.type ?? currentAddress.type;
      const targetIsPrimary = input.isPrimary ?? currentAddress.isPrimary;

      if (targetIsPrimary) {
        await tx.customerAddress.updateMany({
          where: {
            organizationId: input.organizationId,
            customerId: input.customerId,
            type: targetType,
            deletedAt: null,
            id: {
              not: input.addressId,
            },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const updatedAddresses = await tx.customerAddress.updateManyAndReturn({
        where: {
          organizationId: input.organizationId,
          customerId: input.customerId,
          id: input.addressId,
          deletedAt: null,
        },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.recipientName !== undefined
            ? { recipientName: input.recipientName }
            : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.addressLine1 !== undefined
            ? { addressLine1: input.addressLine1 }
            : {}),
          ...(input.addressLine2 !== undefined
            ? { addressLine2: input.addressLine2 }
            : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.province !== undefined ? { province: input.province } : {}),
          ...(input.postalCode !== undefined
            ? { postalCode: input.postalCode }
            : {}),
          ...(input.countryCode !== undefined
            ? { countryCode: input.countryCode }
            : {}),
          ...(input.isPrimary !== undefined
            ? { isPrimary: input.isPrimary }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        limit: 1,
      });

      const address = updatedAddresses[0];

      if (!address) {
        return null;
      }

      const beforeData = this.addressAuditSnapshot(
        this.toCustomerAddressRecord(currentAddress),
      );
      const addressRecord = this.toCustomerAddressRecord(address);
      const afterData = this.addressAuditSnapshot(addressRecord);
      const fields = changedFields(beforeData, afterData);

      if (context && fields.length > 0) {
        await this.auditWriter.write(tx, {
          context,
          action: 'customer.address.updated',
          entityType: 'CUSTOMER_ADDRESS',
          entityId: addressRecord.id,
          changedFields: fields,
          beforeData,
          afterData,
          payload: {
            customerId: input.customerId,
            addressId: addressRecord.id,
            changedFields: fields,
          },
        });
      }

      return addressRecord;
    });
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

  private toCustomerAddressRecord(
    address: CustomerAddress,
  ): CustomerAddressRecord {
    return {
      id: address.id,
      customerId: address.customerId,
      type: address.type,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
      isPrimary: address.isPrimary,
      isActive: address.isActive,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  private addressAuditSnapshot(
    address: CustomerAddressRecord,
  ): Record<string, unknown> {
    return {
      customerId: address.customerId,
      type: address.type,
      label: address.label,
      hasRecipientName: address.recipientName !== null,
      hasPhone: address.phone !== null,
      hasAddressLine1: address.addressLine1.length > 0,
      hasAddressLine2: address.addressLine2 !== null,
      city: address.city,
      province: address.province,
      countryCode: address.countryCode,
      hasPostalCode: address.postalCode !== null,
      isPrimary: address.isPrimary,
      isActive: address.isActive,
    };
  }
}
