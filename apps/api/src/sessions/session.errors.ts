abstract class SessionError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidSessionInputError extends SessionError {
  readonly code = 'SESSION_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class SessionCreationDeniedError extends SessionError {
  readonly code = 'SESSION_CREATION_DENIED';

  constructor() {
    super('Session creation denied');
  }
}

export class InvalidSessionTokenError extends SessionError {
  readonly code = 'SESSION_INVALID_TOKEN';

  constructor() {
    super('Invalid session token');
  }
}
