abstract class AuthError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidAuthenticationInputError extends AuthError {
  readonly code = 'AUTH_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class InvalidCredentialsError extends AuthError {
  readonly code = 'AUTH_INVALID_CREDENTIALS';

  constructor() {
    super('Invalid credentials');
  }
}

export class AccountTemporarilyLockedError extends AuthError {
  readonly code = 'AUTH_ACCOUNT_TEMPORARILY_LOCKED';

  constructor() {
    super('Account temporarily locked');
  }
}

export class OrganizationAccessDeniedError extends AuthError {
  readonly code = 'AUTH_ORGANIZATION_ACCESS_DENIED';

  constructor() {
    super('Organization access denied');
  }
}
