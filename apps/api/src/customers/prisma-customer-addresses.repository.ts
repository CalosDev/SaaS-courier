import { Injectable } from '@nestjs/common';
import { Prisma, type CustomerAddress } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

      return this.toCustomerAddressRecord(address);
    });
  }

  async update(
    input: UpdateCustomerAddressRecord,
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

      return address ? this.toCustomerAddressRecord(address) : null;
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
}
