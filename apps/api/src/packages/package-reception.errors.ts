abstract class PackageReceptionError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class PackageReceptionNotFoundError extends PackageReceptionError {
  readonly code = 'PACKAGE_RECEPTION_NOT_FOUND';

  constructor(packageId: string) {
    super(`Package reception not found: ${packageId}`);
  }
}

export class PackageReceptionConflictError extends PackageReceptionError {
  readonly code = 'PACKAGE_RECEPTION_CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

export class PackageReceptionFacilityUnavailableError extends PackageReceptionError {
  readonly code = 'PACKAGE_RECEPTION_FACILITY_UNAVAILABLE';

  constructor() {
    super('The selected facility is not available for package reception');
  }
}
