import { Inject, Injectable } from '@nestjs/common';

import {
  FacilityNotFoundError,
  InvalidFacilityInputError,
} from './facility.errors';
import { FacilitiesRepository } from './facilities.repository';
import {
  FACILITY_OWNERSHIP_TYPE_VALUES,
  FACILITY_TYPE_VALUES,
  type CreateFacilityInput,
  type CreateFacilityRecord,
  type FacilityListResult,
  type FacilityOwnershipType,
  type FacilityRecord,
  type FacilityType,
  type ListFacilitiesInput,
  type ListFacilitiesRecord,
  type UpdateFacilityInput,
  type UpdateFacilityRecord,
} from './facility.types';

const FACILITY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,39}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class FacilitiesService {
  constructor(
    @Inject(FacilitiesRepository)
    private readonly facilitiesRepository: FacilitiesRepository,
  ) {}

  async create(
    organizationId: string,
    input: CreateFacilityInput,
  ): Promise<FacilityRecord> {
    const record = this.normalizeCreateInput(organizationId, input);

    return this.facilitiesRepository.create(record);
  }

  async list(
    organizationId: string,
    input: ListFacilitiesInput,
  ): Promise<FacilityListResult> {
    const record = this.normalizeListInput(organizationId, input);

    return this.facilitiesRepository.list(record);
  }

  async getById(
    organizationId: string,
    facilityId: string,
  ): Promise<FacilityRecord> {
    const facility = await this.facilitiesRepository.findById(
      this.normalizeRequiredField(organizationId, 'organizationId'),
      this.normalizeRequiredField(facilityId, 'facilityId'),
    );

    if (!facility) {
      throw new FacilityNotFoundError(facilityId);
    }

    return facility;
  }

  async update(
    organizationId: string,
    facilityId: string,
    input: UpdateFacilityInput,
  ): Promise<FacilityRecord> {
    const record = this.normalizeUpdateInput(organizationId, facilityId, input);
    const facility = await this.facilitiesRepository.update(record);

    if (!facility) {
      throw new FacilityNotFoundError(record.facilityId);
    }

    return facility;
  }

  private normalizeCreateInput(
    organizationId: string,
    input: CreateFacilityInput,
  ): CreateFacilityRecord {
    return {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      code: this.normalizeCode(input.code),
      name: this.normalizeRequiredField(input.name, 'name'),
      type: this.normalizeFacilityType(input.type),
      ownershipType: this.normalizeOwnershipType(
        input.ownershipType ?? 'OWNED',
      ),
      countryCode: this.normalizeCountryCode(input.countryCode ?? 'DO'),
      province: this.normalizeOptionalField(input.province),
      city: this.normalizeOptionalField(input.city),
      addressLine1: this.normalizeOptionalField(input.addressLine1),
      addressLine2: this.normalizeOptionalField(input.addressLine2),
      phone: this.normalizeOptionalField(input.phone),
      email: this.normalizeOptionalEmail(input.email),
      isCustomerFacing: input.isCustomerFacing ?? true,
      isPackageOrigin: input.isPackageOrigin ?? false,
      isDistributionCenter: input.isDistributionCenter ?? false,
      isActive: true,
    };
  }

  private normalizeListInput(
    organizationId: string,
    input: ListFacilitiesInput,
  ): ListFacilitiesRecord {
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidFacilityInputError(
        'Invalid facility input: page must be a positive integer',
      );
    }

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new InvalidFacilityInputError(
        'Invalid facility input: pageSize is out of range',
      );
    }

    return {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      page,
      pageSize,
      isActive: input.isActive,
      type:
        input.type === undefined
          ? undefined
          : this.normalizeFacilityType(input.type),
    };
  }

  private normalizeUpdateInput(
    organizationId: string,
    facilityId: string,
    input: UpdateFacilityInput,
  ): UpdateFacilityRecord {
    const record: UpdateFacilityRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
      facilityId: this.normalizeRequiredField(facilityId, 'facilityId'),
    };

    if (input.code !== undefined) {
      record.code = this.normalizeCode(input.code ?? '');
    }

    if (input.name !== undefined) {
      record.name = this.normalizeRequiredField(input.name ?? '', 'name');
    }

    if (input.type !== undefined) {
      record.type = this.normalizeFacilityType(input.type);
    }

    if (input.ownershipType !== undefined) {
      record.ownershipType = this.normalizeOwnershipType(input.ownershipType);
    }

    if (input.countryCode !== undefined) {
      record.countryCode = this.normalizeCountryCode(input.countryCode ?? '');
    }

    if (input.province !== undefined) {
      record.province = this.normalizeOptionalField(input.province);
    }

    if (input.city !== undefined) {
      record.city = this.normalizeOptionalField(input.city);
    }

    if (input.addressLine1 !== undefined) {
      record.addressLine1 = this.normalizeOptionalField(input.addressLine1);
    }

    if (input.addressLine2 !== undefined) {
      record.addressLine2 = this.normalizeOptionalField(input.addressLine2);
    }

    if (input.phone !== undefined) {
      record.phone = this.normalizeOptionalField(input.phone);
    }

    if (input.email !== undefined) {
      record.email = this.normalizeOptionalEmail(input.email);
    }

    if (input.isCustomerFacing !== undefined) {
      record.isCustomerFacing = input.isCustomerFacing;
    }

    if (input.isPackageOrigin !== undefined) {
      record.isPackageOrigin = input.isPackageOrigin;
    }

    if (input.isDistributionCenter !== undefined) {
      record.isDistributionCenter = input.isDistributionCenter;
    }

    if (input.isActive !== undefined) {
      record.isActive = input.isActive;
    }

    if (Object.keys(record).length === 2) {
      throw new InvalidFacilityInputError(
        'Invalid facility input: at least one field is required',
      );
    }

    return record;
  }

  private normalizeCode(code: string): string {
    const normalizedCode = this.normalizeRequiredField(
      code,
      'code',
    ).toUpperCase();

    if (!FACILITY_CODE_PATTERN.test(normalizedCode)) {
      throw new InvalidFacilityInputError(
        'Invalid facility input: code format is invalid',
      );
    }

    return normalizedCode;
  }

  private normalizeCountryCode(countryCode: string): string {
    const normalizedCountryCode = this.normalizeRequiredField(
      countryCode,
      'countryCode',
    ).toUpperCase();

    if (!COUNTRY_CODE_PATTERN.test(normalizedCountryCode)) {
      throw new InvalidFacilityInputError(
        'Invalid facility input: countryCode format is invalid',
      );
    }

    return normalizedCountryCode;
  }

  private normalizeFacilityType(type: string): FacilityType {
    if ((FACILITY_TYPE_VALUES as readonly string[]).includes(type)) {
      return type as FacilityType;
    }

    throw new InvalidFacilityInputError(
      'Invalid facility input: type is invalid',
    );
  }

  private normalizeOwnershipType(type: string): FacilityOwnershipType {
    if ((FACILITY_OWNERSHIP_TYPE_VALUES as readonly string[]).includes(type)) {
      return type as FacilityOwnershipType;
    }

    throw new InvalidFacilityInputError(
      'Invalid facility input: ownershipType is invalid',
    );
  }

  private normalizeRequiredField(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new InvalidFacilityInputError(
        `Invalid facility input: ${field} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidFacilityInputError(
        `Invalid facility input: ${field} is required`,
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
}
