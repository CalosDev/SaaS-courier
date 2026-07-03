import type {
  CreateFacilityRecord,
  FacilityListResult,
  FacilityRecord,
  ListFacilitiesRecord,
  UpdateFacilityRecord,
} from './facility.types';
import type { CommandContext } from '../request-context/request-context.types';

export abstract class FacilitiesRepository {
  abstract create(
    input: CreateFacilityRecord,
    context?: CommandContext,
  ): Promise<FacilityRecord>;

  abstract list(input: ListFacilitiesRecord): Promise<FacilityListResult>;

  abstract findById(
    organizationId: string,
    facilityId: string,
  ): Promise<FacilityRecord | null>;

  abstract update(
    input: UpdateFacilityRecord,
    context?: CommandContext,
  ): Promise<FacilityRecord | null>;
}
