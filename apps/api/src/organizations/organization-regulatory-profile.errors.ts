abstract class OrganizationRegulatoryProfileError extends Error {
  abstract readonly code: string;
}

export class InvalidOrganizationRegulatoryProfileInputError extends OrganizationRegulatoryProfileError {
  readonly code = 'ORGANIZATION_REGULATORY_PROFILE_INVALID_INPUT';
}

export class OrganizationRegulatoryProfileNotFoundError extends OrganizationRegulatoryProfileError {
  readonly code = 'ORGANIZATION_REGULATORY_PROFILE_NOT_FOUND';

  constructor(organizationId: string) {
    super(`Organization regulatory profile not found: ${organizationId}`);
  }
}
