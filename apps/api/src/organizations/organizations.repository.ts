import type {
  CreateOrganizationRecord,
  OrganizationRecord,
  UpdateOrganizationProfileRecord,
} from './organization.types';

export abstract class OrganizationsRepository {
  abstract create(input: CreateOrganizationRecord): Promise<OrganizationRecord>;

  abstract findById(id: string): Promise<OrganizationRecord | null>;

  abstract findBySlug(slug: string): Promise<OrganizationRecord | null>;

  abstract updateProfile(
    input: UpdateOrganizationProfileRecord,
  ): Promise<OrganizationRecord | null>;
}
