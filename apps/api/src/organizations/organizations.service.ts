import { Inject, Injectable } from '@nestjs/common';

import {
  InvalidOrganizationInputError,
  OrganizationNotFoundError,
} from './organization.errors';
import type {
  CreateOrganizationInput,
  CreateOrganizationRecord,
  OrganizationRecord,
  UpdateOrganizationProfileInput,
  UpdateOrganizationProfileRecord,
} from './organization.types';
import { OrganizationsRepository } from './organizations.repository';
import type { CommandContext } from '../request-context/request-context.types';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsRepository)
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async create(input: CreateOrganizationInput): Promise<OrganizationRecord> {
    const record = this.normalizeCreateInput(input);

    return this.organizationsRepository.create(record);
  }

  async getById(id: string): Promise<OrganizationRecord> {
    const organization = await this.organizationsRepository.findById(id);

    if (!organization) {
      throw new OrganizationNotFoundError(id);
    }

    return organization;
  }

  async getBySlug(slug: string): Promise<OrganizationRecord> {
    const normalizedSlug = this.normalizeRequiredField(
      slug,
      'slug',
    ).toLowerCase();

    if (!SLUG_PATTERN.test(normalizedSlug)) {
      throw new InvalidOrganizationInputError(
        'Invalid organization input: slug format is invalid',
      );
    }

    const organization =
      await this.organizationsRepository.findBySlug(normalizedSlug);

    if (!organization) {
      throw new OrganizationNotFoundError(normalizedSlug);
    }

    return organization;
  }

  async updateProfile(
    organizationId: string,
    input: UpdateOrganizationProfileInput,
    context?: CommandContext,
  ): Promise<OrganizationRecord> {
    const record = this.normalizeUpdateProfileInput(organizationId, input);
    const organization = context
      ? await this.organizationsRepository.updateProfile(record, context)
      : await this.organizationsRepository.updateProfile(record);

    if (!organization) {
      throw new OrganizationNotFoundError(record.organizationId);
    }

    return organization;
  }

  private normalizeCreateInput(
    input: CreateOrganizationInput,
  ): CreateOrganizationRecord {
    const legalName = this.normalizeRequiredField(input.legalName, 'legalName');
    const commercialName = this.normalizeRequiredField(
      input.commercialName,
      'commercialName',
    );
    const slug = this.normalizeRequiredField(input.slug, 'slug').toLowerCase();

    if (!SLUG_PATTERN.test(slug)) {
      throw new InvalidOrganizationInputError(
        'Invalid organization input: slug format is invalid',
      );
    }

    return {
      legalName,
      commercialName,
      slug,
      rnc: this.normalizeOptionalField(input.rnc),
      email: this.normalizeOptionalField(input.email)?.toLowerCase() ?? null,
      phone: this.normalizeOptionalField(input.phone),
    };
  }

  private normalizeUpdateProfileInput(
    organizationId: string,
    input: UpdateOrganizationProfileInput,
  ): UpdateOrganizationProfileRecord {
    const record: UpdateOrganizationProfileRecord = {
      organizationId: this.normalizeRequiredField(
        organizationId,
        'organizationId',
      ),
    };

    if ('legalName' in input) {
      record.legalName = this.normalizeRequiredField(
        input.legalName ?? '',
        'legalName',
      );
    }

    if ('commercialName' in input) {
      record.commercialName = this.normalizeRequiredField(
        input.commercialName ?? '',
        'commercialName',
      );
    }

    if ('rnc' in input) {
      record.rnc = this.normalizeOptionalField(input.rnc);
    }

    if ('email' in input) {
      record.email =
        this.normalizeOptionalField(input.email)?.toLowerCase() ?? null;
    }

    if ('phone' in input) {
      record.phone = this.normalizeOptionalField(input.phone);
    }

    if (Object.keys(record).length === 1) {
      throw new InvalidOrganizationInputError(
        'Invalid organization input: at least one field is required',
      );
    }

    return record;
  }

  private normalizeRequiredField(value: string, field: string): string {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidOrganizationInputError(
        `Invalid organization input: ${field} is required`,
      );
    }

    return normalizedValue;
  }

  private normalizeOptionalField(value?: string): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue || null;
  }
}
