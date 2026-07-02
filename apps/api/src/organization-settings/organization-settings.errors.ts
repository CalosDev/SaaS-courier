abstract class OrganizationSettingsError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidOrganizationSettingsInputError extends OrganizationSettingsError {
  readonly code = 'ORGANIZATION_SETTINGS_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class OrganizationSettingsNotFoundError extends OrganizationSettingsError {
  readonly code = 'ORGANIZATION_SETTINGS_NOT_FOUND';

  constructor(organizationId: string) {
    super(`Organization settings not found: ${organizationId}`);
  }
}

export class OnboardingRequirementsIncompleteError extends OrganizationSettingsError {
  readonly code = 'ONBOARDING_REQUIREMENTS_INCOMPLETE';

  constructor() {
    super('Onboarding requirements are incomplete');
  }
}

export class OnboardingAlreadyCompletedError extends OrganizationSettingsError {
  readonly code = 'ONBOARDING_ALREADY_COMPLETED';

  constructor() {
    super('Onboarding has already been completed');
  }
}
