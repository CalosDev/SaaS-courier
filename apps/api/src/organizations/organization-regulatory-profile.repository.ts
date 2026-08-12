import type { CommandContext } from '../request-context/request-context.types';
import type {
  OrganizationRegulatoryProfileRecord,
  UpdateOrganizationRegulatoryProfileRecord,
} from './organization-regulatory-profile.types';

export abstract class OrganizationRegulatoryProfileRepository {
  abstract findCurrent(
    organizationId: string,
  ): Promise<OrganizationRegulatoryProfileRecord | null>;

  abstract updateCurrent(
    input: UpdateOrganizationRegulatoryProfileRecord,
    context: CommandContext,
  ): Promise<OrganizationRegulatoryProfileRecord | null>;
}
