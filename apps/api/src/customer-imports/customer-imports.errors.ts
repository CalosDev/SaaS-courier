abstract class CustomerImportError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCustomerImportInputError extends CustomerImportError {
  readonly code = 'CUSTOMER_IMPORT_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class CustomerImportJobNotFoundError extends CustomerImportError {
  readonly code = 'CUSTOMER_IMPORT_JOB_NOT_FOUND';

  constructor(importJobId: string) {
    super(`Customer import job not found: ${importJobId}`);
  }
}

export class CustomerImportValidationError extends CustomerImportError {
  readonly code = 'CUSTOMER_IMPORT_VALIDATION_FAILED';

  constructor() {
    super('Customer import validation failed');
  }
}

export class CustomerImportStateConflictError extends CustomerImportError {
  readonly code = 'CUSTOMER_IMPORT_STATE_CONFLICT';

  constructor(message: string) {
    super(message);
  }
}
