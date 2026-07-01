import { Injectable } from '@nestjs/common';
import { Prisma, type Customer } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvalidCustomerInputError } from './customer.errors';
import { CustomersRepository } from './customers.repository';
import type {
  CreateCustomerRecord,
  CustomerListResult,
  CustomerRecord,
  ListCustomersRecord,
  UpdateCustomerRecord,
} from './customer.types';

@Injectable()
export class PrismaCustomersRepository implements CustomersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(input: CreateCustomerRecord): Promise<CustomerRecord> {
    const customer = await this.prismaService.customer.create({
      data: {
        organizationId: input.organizationId,
        customerCode: input.customerCode,
        type: input.type,
        firstName: input.firstName,
        lastName: input.lastName,
        businessName: input.businessName,
        email: input.email,
        phone: input.phone,
        mobilePhone: input.mobilePhone,
        status: input.status,
        notes: input.notes,
      },
    });

    return this.toCustomerRecord(customer);
  }

  async findById(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerRecord | null> {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        organizationId,
        id: customerId,
        deletedAt: null,
      },
    });

    return customer ? this.toCustomerRecord(customer) : null;
  }

  async list(input: ListCustomersRecord): Promise<CustomerListResult> {
    const where: Prisma.CustomerWhereInput = {
      organizationId: input.organizationId,
      deletedAt: null,
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.q
        ? {
            OR: [
              {
                customerCode: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                firstName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                businessName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                mobilePhone: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, customers] = await this.prismaService.$transaction([
      this.prismaService.customer.count({ where }),
      this.prismaService.customer.findMany({
        where,
        orderBy: [{ customerCode: 'asc' }, { id: 'asc' }],
        skip,
        take: input.pageSize,
      }),
    ]);

    return {
      items: customers.map((customer) => this.toCustomerRecord(customer)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async update(input: UpdateCustomerRecord): Promise<CustomerRecord | null> {
    const currentCustomer = await this.prismaService.customer.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.customerId,
        deletedAt: null,
      },
    });

    if (!currentCustomer) {
      return null;
    }

    const nextFirstName = input.firstName ?? currentCustomer.firstName;
    const nextLastName = input.lastName ?? currentCustomer.lastName;
    const nextBusinessName = input.businessName ?? currentCustomer.businessName;

    if (
      currentCustomer.type === 'INDIVIDUAL' &&
      (!nextFirstName || !nextLastName)
    ) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: firstName and lastName are required for individuals',
      );
    }

    if (currentCustomer.type === 'BUSINESS' && !nextBusinessName) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: businessName is required for businesses',
      );
    }

    const updatedCustomers =
      await this.prismaService.customer.updateManyAndReturn({
        where: {
          organizationId: input.organizationId,
          id: input.customerId,
          deletedAt: null,
        },
        data: {
          ...(input.firstName !== undefined
            ? { firstName: input.firstName }
            : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.businessName !== undefined
            ? { businessName: input.businessName }
            : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.mobilePhone !== undefined
            ? { mobilePhone: input.mobilePhone }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        limit: 1,
      });

    const customer = updatedCustomers[0];

    return customer ? this.toCustomerRecord(customer) : null;
  }

  private toCustomerRecord(customer: Customer): CustomerRecord {
    return {
      id: customer.id,
      customerCode: customer.customerCode,
      type: customer.type,
      firstName: customer.firstName,
      lastName: customer.lastName,
      businessName: customer.businessName,
      email: customer.email,
      phone: customer.phone,
      mobilePhone: customer.mobilePhone,
      status: customer.status,
      notes: customer.notes,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
