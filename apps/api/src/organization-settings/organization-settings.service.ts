import { Inject, Injectable } from '@nestjs/common';
import { OrganizationSettingsRepository } from './organization-settings.repository';
import { PlanCatalogService } from './plan-catalog.service';
import {
  CUSTOMER_CODE_STRATEGY_VALUES,
  DATE_DISPLAY_FORMAT_VALUES,
  DIMENSION_UNIT_VALUES,
  WEIGHT_UNIT_VALUES,
  type OrganizationCapabilitiesRecord,
  type OrganizationSettingsCurrentRecord,
  type UpdateOrganizationSettingsInput,
  type UpdateOrganizationSettingsRecord,
} from './organization-settings.types';
import {
  InvalidOrganizationSettingsInputError,
  OrganizationSettingsNotFoundError,
} from './organization-settings.errors';
import type { CommandContext } from '../request-context/request-context.types';

const LOCALE_PATTERN = /^[a-z]{2}-[A-Z]{2}$/;
const CUSTOMER_CODE_PREFIX_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,7}$/;

@Injectable()
export class OrganizationSettingsService {
  constructor(
    @Inject(OrganizationSettingsRepository)
    private readonly organizationSettingsRepository: OrganizationSettingsRepository,
    private readonly planCatalogService: PlanCatalogService,
  ) {}

  async getCurrent(
    organizationId: string,
  ): Promise<OrganizationSettingsCurrentRecord> {
    const record = await this.organizationSettingsRepository.findCurrent(
      this.normalizeRequiredField(organizationId, 'organizationId'),
    );

    if (!record) {
      throw new OrganizationSettingsNotFoundError(organizationId);
    }

    return record;
  }

  async updateCurrent(
    organizationId: string,
    input: UpdateOrganizationSettingsInput,
    context?: CommandContext,
  ): Promise<OrganizationSettingsCurrentRecord> {
    const record = this.normalizeUpdateInput(organizationId, input);
    const updated = context
      ? await this.organizationSettingsRepository.updateCurrent(record, context)
      : await this.organizationSettingsRepository.updateCurrent(record);

    if (!updated) {
      throw new OrganizationSettingsNotFoundError(record.organizationId);
    }

    return updated;
  }

  async getCapabilities(
    organizationId: string,
  ): Promise<OrganizationCapabilitiesRecord> {
    const snapshot =
      await this.organizationSettingsRepository.getCapabilitiesSnapshot(
        this.normalizeRequiredField(organizationId, 'organizationId'),
      );

    if (!snapshot) {
      throw new OrganizationSettingsNotFoundError(organizationId);
    }

    const plan = this.planCatalogService.getPlan(
      snapshot.organization.planCode,
    );

    return {
      planCode: snapshot.organization.planCode,
      modules: [...plan.modules],
      limits: {
        maxUsers: snapshot.organization.maxUsers,
        maxFacilities: snapshot.organization.maxFacilities,
      },
      usage: snapshot.usage,
    };
  }

  private normalizeUpdateInput(
    organizationId: string,
    input: UpdateOrganizationSettingsInput,
  ): UpdateOrganizationSettingsRecord {
    const record: UpdateOrganizationSettingsRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
    };

    if (input.locale !== undefined) {
      const locale = this.normalizeRequiredField(input.locale, 'locale');

      if (!LOCALE_PATTERN.test(locale)) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: locale format is invalid',
        );
      }

      record.locale = locale;
    }

    if (input.dateFormat !== undefined) {
      if (
        !(DATE_DISPLAY_FORMAT_VALUES as readonly string[]).includes(
          input.dateFormat,
        )
      ) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: dateFormat is invalid',
        );
      }

      record.dateFormat = input.dateFormat;
    }

    if (input.weightUnit !== undefined) {
      if (
        !(WEIGHT_UNIT_VALUES as readonly string[]).includes(input.weightUnit)
      ) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: weightUnit is invalid',
        );
      }

      record.weightUnit = input.weightUnit;
    }

    if (input.dimensionUnit !== undefined) {
      if (
        !(DIMENSION_UNIT_VALUES as readonly string[]).includes(
          input.dimensionUnit,
        )
      ) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: dimensionUnit is invalid',
        );
      }

      record.dimensionUnit = input.dimensionUnit;
    }

    if (input.timezone !== undefined) {
      const timezone = this.normalizeRequiredField(input.timezone, 'timezone');

      try {
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
        });
      } catch {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: timezone is invalid',
        );
      }

      record.timezone = timezone;
    }

    if (input.currencyCode !== undefined) {
      const currencyCode = this.normalizeRequiredField(
        input.currencyCode,
        'currencyCode',
      ).toUpperCase();

      if (!/^[A-Z]{3}$/.test(currencyCode)) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: currencyCode is invalid',
        );
      }

      record.currencyCode = currencyCode;
    }

    if (input.countryCode !== undefined) {
      const countryCode = this.normalizeRequiredField(
        input.countryCode,
        'countryCode',
      ).toUpperCase();

      if (!/^[A-Z]{2}$/.test(countryCode)) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: countryCode is invalid',
        );
      }

      record.countryCode = countryCode;
    }

    if (input.customerCodeStrategy !== undefined) {
      if (
        !(CUSTOMER_CODE_STRATEGY_VALUES as readonly string[]).includes(
          input.customerCodeStrategy,
        )
      ) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: customerCodeStrategy is invalid',
        );
      }

      record.customerCodeStrategy = input.customerCodeStrategy;
    }

    if (input.customerCodePrefix !== undefined) {
      const prefix = this.normalizeRequiredField(
        input.customerCodePrefix,
        'customerCodePrefix',
      ).toUpperCase();

      if (!CUSTOMER_CODE_PREFIX_PATTERN.test(prefix)) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: customerCodePrefix is invalid',
        );
      }

      record.customerCodePrefix = prefix;
    }

    if (input.customerCodeRandomLength !== undefined) {
      if (
        !Number.isInteger(input.customerCodeRandomLength) ||
        input.customerCodeRandomLength < 4 ||
        input.customerCodeRandomLength > 16
      ) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: customerCodeRandomLength is invalid',
        );
      }

      record.customerCodeRandomLength = input.customerCodeRandomLength;
    }

    if (input.customerCodeSequencePadding !== undefined) {
      if (
        !Number.isInteger(input.customerCodeSequencePadding) ||
        input.customerCodeSequencePadding < 3 ||
        input.customerCodeSequencePadding > 12
      ) {
        throw new InvalidOrganizationSettingsInputError(
          'Invalid organization settings input: customerCodeSequencePadding is invalid',
        );
      }

      record.customerCodeSequencePadding = input.customerCodeSequencePadding;
    }

    const updatedFields = Object.keys(record).length - 1;

    if (updatedFields < 1) {
      throw new InvalidOrganizationSettingsInputError(
        'Invalid organization settings input: at least one field is required',
      );
    }

    const effectivePrefix = record.customerCodePrefix ?? 'C';
    const effectiveRandomLength = record.customerCodeRandomLength ?? 8;
    const effectivePadding = record.customerCodeSequencePadding ?? 6;

    if (effectivePrefix.length + effectiveRandomLength > 40) {
      throw new InvalidOrganizationSettingsInputError(
        'Invalid organization settings input: random customer code length exceeds limit',
      );
    }

    if (effectivePrefix.length + effectivePadding > 40) {
      throw new InvalidOrganizationSettingsInputError(
        'Invalid organization settings input: sequential customer code length exceeds limit',
      );
    }

    return record;
  }

  private normalizeRequiredField(value: string, field: string): string {
    if (typeof value !== 'string') {
      throw new InvalidOrganizationSettingsInputError(
        `Invalid organization settings input: ${field} is required`,
      );
    }

    const normalized = value.trim();

    if (!normalized) {
      throw new InvalidOrganizationSettingsInputError(
        `Invalid organization settings input: ${field} is required`,
      );
    }

    return normalized;
  }
}
