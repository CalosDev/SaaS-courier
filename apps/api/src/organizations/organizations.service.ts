import { Inject, Injectable } from '@nestjs/common';

import {
  InvalidOrganizationInputError,
  OrganizationNotFoundError,
} from './organization.errors';
import type {
  CreateOrganizationInput,
  CreateOrganizationRecord,
  OrganizationRecord,
} from './organization.types';
import { OrganizationsRepository } from './organizations.repository';

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
