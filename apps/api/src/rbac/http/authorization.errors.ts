abstract class AuthorizationError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InsufficientPermissionsError extends AuthorizationError {
  readonly code = 'INSUFFICIENT_PERMISSIONS';

  constructor() {
    super('Insufficient permissions');
  }
}

export class AuthorizationPolicyMissingError extends AuthorizationError {
  readonly code = 'AUTHORIZATION_POLICY_MISSING';

  constructor() {
    super('Authorization policy missing');
  }
}
