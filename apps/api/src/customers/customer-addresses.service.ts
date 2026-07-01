import { Inject, Injectable } from '@nestjs/common';

import {
  CustomerAddressNotFoundError,
  InvalidCustomerInputError,
} from './customer.errors';
import { CustomerAddressesRepository } from './customer-addresses.repository';
import {
  CUSTOMER_ADDRESS_TYPE_VALUES,
  type CreateCustomerAddressInput,
  type CreateCustomerAddressRecord,
  type CustomerAddressRecord,
  type CustomerAddressType,
  type UpdateCustomerAddressInput,
  type UpdateCustomerAddressRecord,
} from './customer.types';

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

@Injectable()
export class CustomerAddressesService {
  constructor(
    @Inject(CustomerAddressesRepository)
    private readonly customerAddressesRepository: CustomerAddressesRepository,
  ) {}

  async listByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerAddressRecord[]> {
    return this.customerAddressesRepository.listByCustomerId(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(customerId, 'customerId'),
    );
  }

  async create(
    organizationId: string,
    customerId: string,
    input: CreateCustomerAddressInput,
  ): Promise<CustomerAddressRecord> {
    return this.customerAddressesRepository.create(
      this.normalizeCreateInput(organizationId, customerId, input),
    );
  }

  async update(
    organizationId: string,
    customerId: string,
    addressId: string,
    input: UpdateCustomerAddressInput,
  ): Promise<CustomerAddressRecord> {
    const address = await this.customerAddressesRepository.update(
      this.normalizeUpdateInput(organizationId, customerId, addressId, input),
    );

    if (!address) {
      throw new CustomerAddressNotFoundError(addressId);
    }

    return address;
  }

  private normalizeCreateInput(
    organizationId: string,
    customerId: string,
    input: CreateCustomerAddressInput,
  ): CreateCustomerAddressRecord {
    return {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      customerId: this.normalizeRequiredField(customerId, 'customerId'),
      type: this.normalizeAddressType(input.type),
      label: this.normalizeOptionalField(input.label),
      recipientName: this.normalizeOptionalField(input.recipientName),
      phone: this.normalizeOptionalField(input.phone),
      addressLine1: this.normalizeRequiredField(
        input.addressLine1,
        'addressLine1',
      ),
      addressLine2: this.normalizeOptionalField(input.addressLine2),
      city: this.normalizeRequiredField(input.city, 'city'),
      province: this.normalizeRequiredField(input.province, 'province'),
      postalCode: this.normalizeOptionalField(input.postalCode),
      countryCode: this.normalizeCountryCode(input.countryCode ?? 'DO'),
      isPrimary: input.isPrimary ?? false,
      isActive: input.isActive ?? true,
    };
  }

  private normalizeUpdateInput(
    organizationId: string,
    customerId: string,
    addressId: string,
    input: UpdateCustomerAddressInput,
  ): UpdateCustomerAddressRecord {
    const record: UpdateCustomerAddressRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      customerId: this.normalizeRequiredField(customerId, 'customerId'),
      addressId: this.normalizeRequiredField(addressId, 'addressId'),
    };

    if (input.type !== undefined) {
      record.type = this.normalizeAddressType(input.type);
    }

    if (input.label !== undefined) {
      record.label = this.normalizeOptionalField(input.label);
    }

    if (input.recipientName !== undefined) {
      record.recipientName = this.normalizeOptionalField(input.recipientName);
    }

    if (input.phone !== undefined) {
      record.phone = this.normalizeOptionalField(input.phone);
    }

    if (input.addressLine1 !== undefined) {
      record.addressLine1 = this.normalizeRequiredField(
        input.addressLine1,
        'addressLine1',
      );
    }

    if (input.addressLine2 !== undefined) {
      record.addressLine2 = this.normalizeOptionalField(input.addressLine2);
    }

    if (input.city !== undefined) {
      record.city = this.normalizeRequiredField(input.city, 'city');
    }

    if (input.province !== undefined) {
      record.province = this.normalizeRequiredField(input.province, 'province');
    }

    if (input.postalCode !== undefined) {
      record.postalCode = this.normalizeOptionalField(input.postalCode);
    }

    if (input.countryCode !== undefined) {
      record.countryCode = this.normalizeCountryCode(input.countryCode);
    }

    if (input.isPrimary !== undefined) {
      record.isPrimary = input.isPrimary;
    }

    if (input.isActive !== undefined) {
      record.isActive = input.isActive;
    }

    if (Object.keys(record).length === 3) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: at least one address field is required',
      );
    }

    return record;
  }

  private normalizeAddressType(type: string): CustomerAddressType {
    if ((CUSTOMER_ADDRESS_TYPE_VALUES as readonly string[]).includes(type)) {
      return type as CustomerAddressType;
    }

    throw new InvalidCustomerInputError(
      'Invalid customer input: address type is invalid',
    );
  }

  private normalizeCountryCode(countryCode: string): string {
    const normalizedCountryCode = this.normalizeRequiredField(
      countryCode,
      'countryCode',
    ).toUpperCase();

    if (!COUNTRY_CODE_PATTERN.test(normalizedCountryCode)) {
      throw new InvalidCustomerInputError(
        'Invalid customer input: countryCode format is invalid',
      );
    }

    return normalizedCountryCode;
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
}
