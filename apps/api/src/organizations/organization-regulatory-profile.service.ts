import { Inject, Injectable } from '@nestjs/common';

import type { CommandContext } from '../request-context/request-context.types';
import {
  InvalidOrganizationRegulatoryProfileInputError,
  OrganizationRegulatoryProfileNotFoundError,
} from './organization-regulatory-profile.errors';
import { OrganizationRegulatoryProfileRepository } from './organization-regulatory-profile.repository';
import {
  COURIER_REGISTRATION_STATUS_VALUES,
  ELECTRONIC_INVOICING_STATUS_VALUES,
  type CourierRegistrationStatus,
  type ElectronicInvoicingStatus,
  type OrganizationRegulatoryProfileRecord,
  type UpdateOrganizationRegulatoryProfileInput,
  type UpdateOrganizationRegulatoryProfileRecord,
} from './organization-regulatory-profile.types';

const DGA_OPERATOR_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{0,79}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class OrganizationRegulatoryProfileService {
  constructor(
    @Inject(OrganizationRegulatoryProfileRepository)
    private readonly repository: OrganizationRegulatoryProfileRepository,
  ) {}

  async getCurrent(
    organizationId: string,
  ): Promise<OrganizationRegulatoryProfileRecord> {
    const profile = await this.repository.findCurrent(
      this.required(organizationId, 'organizationId', 36),
    );
    if (!profile) {
      throw new OrganizationRegulatoryProfileNotFoundError(organizationId);
    }
    return profile;
  }

  async updateCurrent(
    organizationId: string,
    input: UpdateOrganizationRegulatoryProfileInput,
    context: CommandContext,
  ): Promise<OrganizationRegulatoryProfileRecord> {
    const record = this.normalizeUpdate(organizationId, input);
    const profile = await this.repository.updateCurrent(record, context);
    if (!profile) {
      throw new OrganizationRegulatoryProfileNotFoundError(organizationId);
    }
    return profile;
  }

  private normalizeUpdate(
    organizationId: string,
    input: UpdateOrganizationRegulatoryProfileInput,
  ): UpdateOrganizationRegulatoryProfileRecord {
    const record: UpdateOrganizationRegulatoryProfileRecord = {
      organizationId: this.required(organizationId, 'organizationId', 36),
      declaredAt: new Date(),
    };

    if ('fiscalAddress' in input) {
      record.fiscalAddress = this.optional(input.fiscalAddress, 500);
    }
    if ('authorizedRepresentativeName' in input) {
      record.authorizedRepresentativeName = this.optional(
        input.authorizedRepresentativeName,
        200,
      );
    }
    if ('authorizedRepresentativeEmail' in input) {
      const email = this.optional(input.authorizedRepresentativeEmail, 320);
      if (email && !EMAIL_PATTERN.test(email)) {
        throw this.invalid('authorizedRepresentativeEmail is invalid');
      }
      record.authorizedRepresentativeEmail = email?.toLowerCase() ?? null;
    }
    if ('authorizedRepresentativePhone' in input) {
      record.authorizedRepresentativePhone = this.optional(
        input.authorizedRepresentativePhone,
        32,
      );
    }
    if ('courierRegistrationStatus' in input) {
      record.courierRegistrationStatus = this.courierStatus(
        input.courierRegistrationStatus,
      );
    }
    if ('dgaOperatorCode' in input) {
      const code = this.optional(input.dgaOperatorCode, 80)?.toUpperCase();
      if (code && !DGA_OPERATOR_CODE_PATTERN.test(code)) {
        throw this.invalid('dgaOperatorCode format is invalid');
      }
      record.dgaOperatorCode = code ?? null;
    }
    if ('electronicInvoicingStatus' in input) {
      record.electronicInvoicingStatus = this.invoicingStatus(
        input.electronicInvoicingStatus,
      );
    }

    if (Object.keys(record).length === 2) {
      throw this.invalid('at least one field is required');
    }
    return record;
  }

  private courierStatus(value: string | undefined): CourierRegistrationStatus {
    if (
      typeof value === 'string' &&
      (COURIER_REGISTRATION_STATUS_VALUES as readonly string[]).includes(value)
    ) {
      return value as CourierRegistrationStatus;
    }
    throw this.invalid('courierRegistrationStatus is invalid');
  }

  private invoicingStatus(
    value: string | undefined,
  ): ElectronicInvoicingStatus {
    if (
      typeof value === 'string' &&
      (ELECTRONIC_INVOICING_STATUS_VALUES as readonly string[]).includes(value)
    ) {
      return value as ElectronicInvoicingStatus;
    }
    throw this.invalid('electronicInvoicingStatus is invalid');
  }

  private required(value: string, field: string, maxLength: number): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > maxLength) {
      throw this.invalid(`${field} is required or exceeds its limit`);
    }
    return normalized;
  }

  private optional(
    value: string | undefined,
    maxLength: number,
  ): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (normalized.length > maxLength) {
      throw this.invalid('field exceeds its limit');
    }
    return normalized || null;
  }

  private invalid(message: string) {
    return new InvalidOrganizationRegulatoryProfileInputError(
      `Invalid organization regulatory profile input: ${message}`,
    );
  }
}
