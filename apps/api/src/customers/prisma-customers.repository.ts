import { Injectable } from '@nestjs/common';
import { changedFields } from '../audit/audit-snapshot';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { Prisma, type Customer } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  CustomerCodeGenerationError,
  InvalidCustomerInputError,
} from './customer.errors';
import { CustomerCodeService } from './customer-code.service';
import { CustomersRepository } from './customers.repository';
import type {
  CreateCustomerRecord,
  CustomerListResult,
  CustomerRecord,
  ListCustomersRecord,
  UpdateCustomerRecord,
} from './customer.types';

type LockedOrganizationSettingsRow = {
  organization_id: string;
  customer_code_strategy: 'AUTO_RANDOM' | 'AUTO_SEQUENTIAL';
  customer_code_prefix: string;
  customer_code_random_length: number;
  customer_code_sequence_padding: number;
  next_customer_sequence: bigint;
};

const RANDOM_CODE_GENERATION_ATTEMPTS = 10;
const SEQUENTIAL_CODE_GENERATION_ATTEMPTS = 1000;

@Injectable()
export class PrismaCustomersRepository implements CustomersRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly customerCodeService: CustomerCodeService,
  ) {}

  async createWithGeneratedCode(
    input: Omit<CreateCustomerRecord, 'customerCode'>,
    context?: CommandContext,
  ): Promise<CustomerRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const settings = await this.lockOrganizationSettings(
        tx,
        input.organizationId,
      );

      const customer =
        settings.customer_code_strategy === 'AUTO_SEQUENTIAL'
          ? await this.createWithSequentialCode(tx, input, settings)
          : await this.createWithRandomCode(tx, input, settings);

      if (context) {
        await this.writeCustomerAudit(
          tx,
          context,
          'customer.created',
          customer,
        );
      }

      return customer;
    });
  }

  async create(
    input: CreateCustomerRecord,
    context?: CommandContext,
  ): Promise<CustomerRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const customer = await tx.customer.create({
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
      const customerRecord = this.toCustomerRecord(customer);

      if (context) {
        await this.writeCustomerAudit(
          tx,
          context,
          'customer.created',
          customerRecord,
        );
      }

      return customerRecord;
    });
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
    const [totalItems, customers] = await this.prismaService.$transaction(
      async (tx) => {
        const totalCount = await tx.customer.count({ where });
        const customerRows = await tx.customer.findMany({
          where,
          orderBy: [{ customerCode: 'asc' }, { id: 'asc' }],
          skip,
          take: input.pageSize,
        });

        return [totalCount, customerRows] as const;
      },
    );

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

  async update(
    input: UpdateCustomerRecord,
    context?: CommandContext,
  ): Promise<CustomerRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const currentCustomer = await tx.customer.findFirst({
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
      const nextBusinessName =
        input.businessName ?? currentCustomer.businessName;

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

      const beforeData = this.customerAuditSnapshot(
        this.toCustomerRecord(currentCustomer),
      );
      const updatedCustomers = await tx.customer.updateManyAndReturn({
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

      if (!customer) {
        return null;
      }

      const customerRecord = this.toCustomerRecord(customer);
      const afterData = this.customerAuditSnapshot(customerRecord);
      const fields = changedFields(beforeData, afterData);

      if (context && fields.length > 0) {
        await this.writeCustomerAudit(
          tx,
          context,
          'customer.updated',
          customerRecord,
          beforeData,
          afterData,
          fields,
        );
      }

      return customerRecord;
    });
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

  private async writeCustomerAudit(
    tx: Prisma.TransactionClient,
    context: CommandContext,
    action: 'customer.created' | 'customer.updated',
    customer: CustomerRecord,
    beforeData?: Record<string, unknown>,
    afterData = this.customerAuditSnapshot(customer),
    fields = Object.keys(afterData),
  ): Promise<void> {
    await this.auditWriter.write(tx, {
      context,
      action,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      changedFields: fields,
      beforeData,
      afterData,
      payload: {
        customerId: customer.id,
        customerCode: customer.customerCode,
        type: customer.type,
        status: customer.status,
      },
    });
  }

  private customerAuditSnapshot(
    customer: CustomerRecord,
  ): Record<string, unknown> {
    return {
      customerCode: customer.customerCode,
      type: customer.type,
      firstName: customer.firstName,
      lastName: customer.lastName,
      businessName: customer.businessName,
      hasEmail: customer.email !== null,
      hasPhone: customer.phone !== null,
      hasMobilePhone: customer.mobilePhone !== null,
      status: customer.status,
      hasNotes: customer.notes !== null,
    };
  }

  private async createWithRandomCode(
    tx: Prisma.TransactionClient,
    input: Omit<CreateCustomerRecord, 'customerCode'>,
    settings: LockedOrganizationSettingsRow,
  ): Promise<CustomerRecord> {
    for (
      let attempt = 0;
      attempt < RANDOM_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const customer = await tx.customer.create({
          data: {
            ...input,
            customerCode: this.customerCodeService.generateRandom({
              prefix: settings.customer_code_prefix,
              randomLength: settings.customer_code_random_length,
            }),
          },
        });

        return this.toCustomerRecord(customer);
      } catch (error) {
        if (this.isCustomerCodeConflictError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new CustomerCodeGenerationError();
  }

  private async createWithSequentialCode(
    tx: Prisma.TransactionClient,
    input: Omit<CreateCustomerRecord, 'customerCode'>,
    settings: LockedOrganizationSettingsRow,
  ): Promise<CustomerRecord> {
    let nextSequence = Number(settings.next_customer_sequence);

    for (
      let attempt = 0;
      attempt < SEQUENTIAL_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const customerCode = this.customerCodeService.formatSequential({
        prefix: settings.customer_code_prefix,
        sequence: nextSequence,
        padding: settings.customer_code_sequence_padding,
      });

      try {
        const customer = await tx.customer.create({
          data: {
            ...input,
            customerCode,
          },
        });

        await tx.organizationSettings.update({
          where: {
            organizationId: input.organizationId,
          },
          data: {
            nextCustomerSequence: BigInt(nextSequence + 1),
          },
        });

        return this.toCustomerRecord(customer);
      } catch (error) {
        if (this.isCustomerCodeConflictError(error)) {
          nextSequence += 1;
          continue;
        }

        throw error;
      }
    }

    throw new CustomerCodeGenerationError();
  }

  private async lockOrganizationSettings(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<LockedOrganizationSettingsRow> {
    const rows = await tx.$queryRaw<LockedOrganizationSettingsRow[]>(Prisma.sql`
      SELECT
        organization_id,
        customer_code_strategy,
        customer_code_prefix,
        customer_code_random_length,
        customer_code_sequence_padding,
        next_customer_sequence
      FROM organization_settings
      WHERE organization_id = ${organizationId}
      FOR UPDATE
    `);
    const settings = rows[0];

    if (!settings) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: organization settings are not available',
      );
    }

    return settings;
  }

  private isCustomerCodeConflictError(error: unknown): boolean {
    if (error instanceof Error && error.message === 'P2002') {
      return true;
    }

    if (!(error instanceof Error) || !('code' in error)) {
      return false;
    }

    const candidate = error as Error & {
      code?: unknown;
      meta?: { modelName?: unknown; target?: unknown };
    };

    if (candidate.code !== 'P2002') {
      return false;
    }

    const target = candidate.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';

    return (
      candidate.meta?.modelName === 'Customer' ||
      targetText.includes('customers_organization_id_customer_code_key') ||
      targetText.includes('customerCode')
    );
  }
}
