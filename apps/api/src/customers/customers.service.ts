import { Inject, Injectable } from '@nestjs/common';

import type { CommandContext } from '../request-context/request-context.types';
import {
  CustomerNotFoundError,
  InvalidCustomerInputError,
} from './customer.errors';
import { CustomersRepository } from './customers.repository';
import {
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
  type CreateCustomerInput,
  type CreateCustomerRecord,
  type CustomerListResult,
  type CustomerRecord,
  type CustomerStatus,
  type CustomerType,
  type ListCustomersInput,
  type ListCustomersRecord,
  type UpdateCustomerInput,
  type UpdateCustomerRecord,
} from './customer.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
@Injectable()
export class CustomersService {
  constructor(
    @Inject(CustomersRepository)
    private readonly customersRepository: CustomersRepository,
  ) {}

  async create(
    organizationId: string,
    input: CreateCustomerInput,
    context?: CommandContext,
  ): Promise<CustomerRecord> {
    const record = this.normalizeCreateInput(organizationId, input);

    return context
      ? this.customersRepository.createWithGeneratedCode(record, context)
      : this.customersRepository.createWithGeneratedCode(record);
  }

  async getById(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerRecord> {
    const customer = await this.customersRepository.findById(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(customerId, 'customerId'),
    );

    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    return customer;
  }

  async list(
    organizationId: string,
    input: ListCustomersInput,
  ): Promise<CustomerListResult> {
    return this.customersRepository.list(
      this.normalizeListInput(organizationId, input),
    );
  }

  async update(
    organizationId: string,
    customerId: string,
    input: UpdateCustomerInput,
    context?: CommandContext,
  ): Promise<CustomerRecord> {
    const record = this.normalizeUpdateInput(organizationId, customerId, input);
    const customer = await (context
      ? this.customersRepository.update(record, context)
      : this.customersRepository.update(record));

    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    return customer;
  }

  private normalizeCreateInput(
    organizationId: string,
    input: CreateCustomerInput,
  ): Omit<CreateCustomerRecord, 'customerCode'> {
    const type = this.normalizeCustomerType(input.type);

    return {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      type,
      firstName:
        type === 'INDIVIDUAL'
          ? this.normalizeRequiredField(input.firstName ?? '', 'firstName')
          : null,
      lastName:
        type === 'INDIVIDUAL'
          ? this.normalizeRequiredField(input.lastName ?? '', 'lastName')
          : null,
      businessName:
        type === 'BUSINESS'
          ? this.normalizeRequiredField(
              input.businessName ?? '',
              'businessName',
            )
          : null,
      email: this.normalizeOptionalEmail(input.email),
      phone: this.normalizeOptionalField(input.phone),
      mobilePhone: this.normalizeOptionalField(input.mobilePhone),
      status: 'PENDING',
      notes: this.normalizeOptionalField(input.notes),
    };
  }

  private normalizeListInput(
    organizationId: string,
    input: ListCustomersInput,
  ): ListCustomersRecord {
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: page must be a positive integer',
      );
    }

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: pageSize is out of range',
      );
    }

    return {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      page,
      pageSize,
      q: this.normalizeSearchQuery(input.q),
      type:
        input.type === undefined
          ? undefined
          : this.normalizeCustomerType(input.type),
      status:
        input.status === undefined
          ? undefined
          : this.normalizeCustomerStatus(input.status),
    };
  }

  private normalizeUpdateInput(
    organizationId: string,
    customerId: string,
    input: UpdateCustomerInput,
  ): UpdateCustomerRecord {
    const record: UpdateCustomerRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      customerId: this.normalizeRequiredField(customerId, 'customerId'),
    };

    if (input.firstName !== undefined) {
      record.firstName = this.normalizeOptionalField(input.firstName);
    }

    if (input.lastName !== undefined) {
      record.lastName = this.normalizeOptionalField(input.lastName);
    }

    if (input.businessName !== undefined) {
      record.businessName = this.normalizeOptionalField(input.businessName);
    }

    if (input.email !== undefined) {
      record.email = this.normalizeOptionalEmail(input.email);
    }

    if (input.phone !== undefined) {
      record.phone = this.normalizeOptionalField(input.phone);
    }

    if (input.mobilePhone !== undefined) {
      record.mobilePhone = this.normalizeOptionalField(input.mobilePhone);
    }

    if (input.status !== undefined) {
      record.status = this.normalizeCustomerStatus(input.status);
    }

    if (input.notes !== undefined) {
      record.notes = this.normalizeOptionalField(input.notes);
    }

    if (Object.keys(record).length === 2) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: at least one field is required',
      );
    }

    return record;
  }

  private normalizeCustomerType(type: string): CustomerType {
    if ((CUSTOMER_TYPE_VALUES as readonly string[]).includes(type)) {
      return type as CustomerType;
    }

    throw new InvalidCustomerInputError(
      'Invalid customer input: type is invalid',
    );
  }

  private normalizeCustomerStatus(status: string): CustomerStatus {
    if ((CUSTOMER_STATUS_VALUES as readonly string[]).includes(status)) {
      return status as CustomerStatus;
    }

    throw new InvalidCustomerInputError(
      'Invalid customer input: status is invalid',
    );
  }

  private normalizeRequiredField(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new InvalidCustomerInputError(
        `Invalid customer input: ${field} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidCustomerInputError(
        `Invalid customer input: ${field} is required`,
      );
    }

    return normalizedValue;
  }

  private normalizeOptionalField(value?: string): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeOptionalEmail(value?: string): string | null {
    const normalizedValue = this.normalizeOptionalField(value);

    return normalizedValue ? normalizedValue.toLowerCase() : null;
  }

  private normalizeSearchQuery(value?: string): string | undefined {
    const normalizedValue = this.normalizeOptionalField(value);

    return normalizedValue ?? undefined;
  }
}
