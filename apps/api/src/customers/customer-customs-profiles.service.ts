import { Inject, Injectable } from '@nestjs/common';

import type { CommandContext } from '../request-context/request-context.types';
import {
  CustomerCustomsProfileNotFoundError,
  InvalidCustomerCustomsProfileError,
} from './customer.errors';
import { CustomerCustomsProfilesRepository } from './customer-customs-profiles.repository';
import {
  CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES,
  CUSTOMS_REGISTRATION_STATUS_VALUES,
  CUSTOMS_VERIFICATION_SOURCE_VALUES,
  type CustomerCustomsProfileRecord,
  type CustomerIdentityDocumentType,
  type CustomsRegistrationStatus,
  type CustomsVerificationSource,
  type UpdateCustomerCustomsVerificationInput,
  type UpdateCustomerCustomsVerificationRecord,
  type UpsertCustomerCustomsProfileIdentityInput,
  type UpsertCustomerCustomsProfileIdentityRecord,
} from './customer.types';

const PASSPORT_PATTERN = /^[A-Z0-9-]{3,30}$/;

@Injectable()
export class CustomerCustomsProfilesService {
  constructor(
    @Inject(CustomerCustomsProfilesRepository)
    private readonly customerCustomsProfilesRepository: CustomerCustomsProfilesRepository,
  ) {}

  async getByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerCustomsProfileRecord> {
    const profile =
      await this.customerCustomsProfilesRepository.findByCustomerId(
        this.normalizeRequiredField(organizationId, 'organizationId'),
        this.normalizeRequiredField(customerId, 'customerId'),
      );

    if (!profile) {
      throw new CustomerCustomsProfileNotFoundError(customerId);
    }

    return profile;
  }

  async upsertIdentity(
    organizationId: string,
    customerId: string,
    input: UpsertCustomerCustomsProfileIdentityInput,
    context?: CommandContext,
  ): Promise<CustomerCustomsProfileRecord> {
    const record: UpsertCustomerCustomsProfileIdentityRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      customerId: this.normalizeRequiredField(customerId, 'customerId'),
      documentType: this.normalizeDocumentType(input.documentType),
      documentNumber: this.normalizeDocumentNumber(
        input.documentType,
        input.documentNumber,
      ),
      ruaStatus: 'UNKNOWN',
      verificationSource: null,
      lastCheckedAt: null,
      verifiedAt: null,
      externalReference: null,
      notes:
        input.notes === undefined
          ? undefined
          : this.normalizeOptionalField(input.notes),
    };

    return context
      ? this.customerCustomsProfilesRepository.upsertIdentity(record, context)
      : this.customerCustomsProfilesRepository.upsertIdentity(record);
  }

  async updateVerification(
    organizationId: string,
    customerId: string,
    input: UpdateCustomerCustomsVerificationInput,
    context?: CommandContext,
  ): Promise<CustomerCustomsProfileRecord> {
    const record = this.normalizeVerificationUpdate(
      organizationId,
      customerId,
      input,
    );
    const profile = await (context
      ? this.customerCustomsProfilesRepository.updateVerification(
          record,
          context,
        )
      : this.customerCustomsProfilesRepository.updateVerification(record));

    if (!profile) {
      throw new CustomerCustomsProfileNotFoundError(record.customerId);
    }

    return profile;
  }

  private normalizeVerificationUpdate(
    organizationId: string,
    customerId: string,
    input: UpdateCustomerCustomsVerificationInput,
  ): UpdateCustomerCustomsVerificationRecord {
    const status = this.normalizeRegistrationStatus(input.status);
    const normalizedNotes =
      input.notes === undefined
        ? undefined
        : this.normalizeOptionalField(input.notes);

    if (status === 'UNKNOWN') {
      return {
        organizationId: this.normalizeRequiredField(
          organizationId,
          'organizationId',
        ),
        customerId: this.normalizeRequiredField(customerId, 'customerId'),
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
        externalReference: null,
        notes: normalizedNotes,
      };
    }

    const source =
      input.source === undefined
        ? null
        : this.normalizeVerificationSource(input.source);
    const checkedAt =
      input.checkedAt === undefined
        ? null
        : this.normalizeDate(input.checkedAt);
    const externalReference =
      input.externalReference === undefined
        ? null
        : this.normalizeOptionalField(input.externalReference);

    if (
      (status === 'REGISTERED' ||
        status === 'NOT_REGISTERED' ||
        status === 'VERIFICATION_FAILED') &&
      (!source || !checkedAt)
    ) {
      throw new InvalidCustomerCustomsProfileError(
        'Invalid customer customs profile input: source and checkedAt are required',
      );
    }

    return {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      customerId: this.normalizeRequiredField(customerId, 'customerId'),
      ruaStatus: status,
      verificationSource: source,
      lastCheckedAt: checkedAt,
      verifiedAt: status === 'REGISTERED' ? checkedAt : null,
      externalReference,
      notes: normalizedNotes,
    };
  }

  private normalizeDocumentType(type: string): CustomerIdentityDocumentType {
    if (
      (CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES as readonly string[]).includes(
        type,
      )
    ) {
      return type as CustomerIdentityDocumentType;
    }

    throw new InvalidCustomerCustomsProfileError(
      'Invalid customer customs profile input: documentType is invalid',
    );
  }

  private normalizeRegistrationStatus(
    status: string,
  ): CustomsRegistrationStatus {
    if (
      (CUSTOMS_REGISTRATION_STATUS_VALUES as readonly string[]).includes(status)
    ) {
      return status as CustomsRegistrationStatus;
    }

    throw new InvalidCustomerCustomsProfileError(
      'Invalid customer customs profile input: status is invalid',
    );
  }

  private normalizeVerificationSource(
    source: string,
  ): CustomsVerificationSource {
    if (
      (CUSTOMS_VERIFICATION_SOURCE_VALUES as readonly string[]).includes(source)
    ) {
      return source as CustomsVerificationSource;
    }

    throw new InvalidCustomerCustomsProfileError(
      'Invalid customer customs profile input: source is invalid',
    );
  }

  private normalizeDocumentNumber(
    type: string,
    documentNumber: string,
  ): string {
    const normalizedValue = this.normalizeRequiredField(
      documentNumber,
      'documentNumber',
    );
    const documentType = this.normalizeDocumentType(type);

    if (documentType === 'CEDULA') {
      const digits = normalizedValue.replace(/\D/g, '');

      if (!/^\d{11}$/.test(digits)) {
        throw new InvalidCustomerCustomsProfileError(
          'Invalid customer customs profile input: cédula format is invalid',
        );
      }

      return digits;
    }

    if (documentType === 'RNC') {
      const digits = normalizedValue.replace(/\D/g, '');

      if (!/^(\d{9}|\d{11})$/.test(digits)) {
        throw new InvalidCustomerCustomsProfileError(
          'Invalid customer customs profile input: RNC format is invalid',
        );
      }

      return digits;
    }

    const passport = normalizedValue.toUpperCase();

    if (!PASSPORT_PATTERN.test(passport)) {
      throw new InvalidCustomerCustomsProfileError(
        'Invalid customer customs profile input: passport format is invalid',
      );
    }

    return passport;
  }

  private normalizeRequiredField(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new InvalidCustomerCustomsProfileError(
        `Invalid customer customs profile input: ${field} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidCustomerCustomsProfileError(
        `Invalid customer customs profile input: ${field} is required`,
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

  private normalizeDate(value: string): Date {
    const parsedDate = new Date(
      this.normalizeRequiredField(value, 'checkedAt'),
    );

    if (Number.isNaN(parsedDate.getTime())) {
      throw new InvalidCustomerCustomsProfileError(
        'Invalid customer customs profile input: checkedAt is invalid',
      );
    }

    return parsedDate;
  }
}
