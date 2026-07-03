abstract class PrealertError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidPrealertInputError extends PrealertError {
  readonly code = 'PREALERT_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class PrealertNotFoundError extends PrealertError {
  readonly code = 'PREALERT_NOT_FOUND';

  constructor(prealertId: string) {
    super(`Prealert not found: ${prealertId}`);
  }
}

export class PrealertCodeGenerationError extends PrealertError {
  readonly code = 'PREALERT_CODE_GENERATION_FAILED';

  constructor() {
    super('Prealert code generation failed');
  }
}

export class PrealertTrackingConflictError extends PrealertError {
  readonly code = 'PREALERT_TRACKING_CONFLICT';

  constructor() {
    super('Prealert tracking conflict');
  }
}

export class PrealertCustomerUnavailableError extends PrealertError {
  readonly code = 'PREALERT_CUSTOMER_UNAVAILABLE';

  constructor(message: string) {
    super(message);
  }
}

export class PrealertImmutableError extends PrealertError {
  readonly code = 'PREALERT_IMMUTABLE';

  constructor(prealertId: string) {
    super(`Prealert is immutable: ${prealertId}`);
  }
}

export class InvalidPrealertStateTransitionError extends PrealertError {
  readonly code = 'PREALERT_INVALID_STATE_TRANSITION';

  constructor(message: string) {
    super(message);
  }
}
