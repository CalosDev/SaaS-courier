abstract class AccountError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidAccountInputError extends AccountError {
  readonly code = 'ACCOUNT_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class InvalidPasswordError extends AccountError {
  readonly code = 'ACCOUNT_INVALID_PASSWORD';

  constructor(message: string) {
    super(message);
  }
}

export class UserEmailConflictError extends AccountError {
  readonly code = 'ACCOUNT_USER_EMAIL_CONFLICT';

  constructor(email: string) {
    super(`User email already exists: ${email}`);
  }
}

export class InvalidActivationTokenError extends AccountError {
  readonly code = 'ACCOUNT_INVALID_ACTIVATION_TOKEN';

  constructor() {
    super('Invalid activation token');
  }
}
