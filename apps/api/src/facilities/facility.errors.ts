abstract class FacilityError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidFacilityInputError extends FacilityError {
  readonly code = 'FACILITY_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class FacilityNotFoundError extends FacilityError {
  readonly code = 'FACILITY_NOT_FOUND';

  constructor(facilityId: string) {
    super(`Facility not found: ${facilityId}`);
  }
}

export class FacilityCodeConflictError extends FacilityError {
  readonly code = 'FACILITY_CODE_CONFLICT';

  constructor(code: string) {
    super(`Facility code already exists: ${code}`);
  }
}

export class FacilityLimitReachedError extends FacilityError {
  readonly code = 'FACILITY_LIMIT_REACHED';

  constructor(limit: number) {
    super(`Facility limit reached: ${limit}`);
  }
}

export class FacilityOrganizationUnavailableError extends FacilityError {
  readonly code = 'FACILITY_ORGANIZATION_UNAVAILABLE';

  constructor(organizationId: string) {
    super(`Facility organization unavailable: ${organizationId}`);
  }
}
