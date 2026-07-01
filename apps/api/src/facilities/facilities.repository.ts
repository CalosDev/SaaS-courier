import type {
  CreateFacilityRecord,
  FacilityListResult,
  FacilityRecord,
  ListFacilitiesRecord,
  UpdateFacilityRecord,
} from './facility.types';

export abstract class FacilitiesRepository {
  abstract create(input: CreateFacilityRecord): Promise<FacilityRecord>;

  abstract list(input: ListFacilitiesRecord): Promise<FacilityListResult>;

  abstract findById(
    organizationId: string,
    facilityId: string,
  ): Promise<FacilityRecord | null>;

  abstract update(input: UpdateFacilityRecord): Promise<FacilityRecord | null>;
}
