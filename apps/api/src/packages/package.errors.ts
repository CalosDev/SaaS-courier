abstract class PackageError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidPackageInputError extends PackageError {
  readonly code = 'PACKAGE_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class PackageNotFoundError extends PackageError {
  readonly code = 'PACKAGE_NOT_FOUND';

  constructor(packageId: string) {
    super(`Package not found: ${packageId}`);
  }
}

export class PackageCodeGenerationError extends PackageError {
  readonly code = 'PACKAGE_CODE_GENERATION_FAILED';

  constructor() {
    super('Package code generation failed');
  }
}

export class PackageTrackingConflictError extends PackageError {
  readonly code = 'PACKAGE_TRACKING_CONFLICT';

  constructor() {
    super('Package tracking conflict');
  }
}

export class PackageCustomerUnavailableError extends PackageError {
  readonly code = 'PACKAGE_CUSTOMER_UNAVAILABLE';

  constructor(message: string) {
    super(message);
  }
}

export class PackagePrealertUnavailableError extends PackageError {
  readonly code = 'PACKAGE_PREALERT_UNAVAILABLE';

  constructor(message: string) {
    super(message);
  }
}

export class PackagePrealertMatchRequiredError extends PackageError {
  readonly code = 'PACKAGE_PREALERT_MATCH_REQUIRED';

  constructor() {
    super('A pending prealert already exists for this tracking number');
  }
}

export class PackageImmutableError extends PackageError {
  readonly code = 'PACKAGE_IMMUTABLE';

  constructor(packageId: string) {
    super(`Package is immutable: ${packageId}`);
  }
}

export class InvalidPackageStatusTransitionError extends PackageError {
  readonly code = 'PACKAGE_INVALID_STATUS_TRANSITION';

  constructor(message: string) {
    super(message);
  }
}
