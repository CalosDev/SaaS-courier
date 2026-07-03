import type {
  OnboardingSnapshot,
  OrganizationCapabilitiesSnapshot,
  OrganizationSettingsCurrentRecord,
  UpdateOrganizationSettingsRecord,
} from './organization-settings.types';
import type { CommandContext } from '../request-context/request-context.types';

export abstract class OrganizationSettingsRepository {
  abstract findCurrent(
    organizationId: string,
  ): Promise<OrganizationSettingsCurrentRecord | null>;

  abstract updateCurrent(
    input: UpdateOrganizationSettingsRecord,
    context?: CommandContext,
  ): Promise<OrganizationSettingsCurrentRecord | null>;

  abstract getCapabilitiesSnapshot(
    organizationId: string,
  ): Promise<OrganizationCapabilitiesSnapshot | null>;

  abstract getOnboardingSnapshot(
    organizationId: string,
  ): Promise<OnboardingSnapshot | null>;

  abstract markOnboardingCompleted(
    organizationId: string,
    context?: CommandContext,
  ): Promise<Date | null>;
}
