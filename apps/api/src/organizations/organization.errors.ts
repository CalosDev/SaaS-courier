abstract class OrganizationError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidOrganizationInputError extends OrganizationError {
  readonly code = 'ORGANIZATION_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class OrganizationNotFoundError extends OrganizationError {
  readonly code = 'ORGANIZATION_NOT_FOUND';

  constructor(identifier: string) {
    super(`Organization not found: ${identifier}`);
  }
}

export class OrganizationSlugConflictError extends OrganizationError {
  readonly code = 'ORGANIZATION_SLUG_CONFLICT';

  constructor(slug: string) {
    super(`Organization slug already exists: ${slug}`);
  }
}
