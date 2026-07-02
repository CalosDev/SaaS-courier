import type {
  OnboardingSnapshot,
  OrganizationCapabilitiesSnapshot,
  OrganizationSettingsCurrentRecord,
  UpdateOrganizationSettingsRecord,
} from './organization-settings.types';

export abstract class OrganizationSettingsRepository {
  abstract findCurrent(
    organizationId: string,
  ): Promise<OrganizationSettingsCurrentRecord | null>;

  abstract updateCurrent(
    input: UpdateOrganizationSettingsRecord,
  ): Promise<OrganizationSettingsCurrentRecord | null>;

  abstract getCapabilitiesSnapshot(
    organizationId: string,
  ): Promise<OrganizationCapabilitiesSnapshot | null>;

  abstract getOnboardingSnapshot(
    organizationId: string,
  ): Promise<OnboardingSnapshot | null>;

  abstract markOnboardingCompleted(
    organizationId: string,
  ): Promise<Date | null>;
}
