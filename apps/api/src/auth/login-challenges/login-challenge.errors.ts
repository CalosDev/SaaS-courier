abstract class LoginChallengeError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidLoginChallengeInputError extends LoginChallengeError {
  readonly code = 'LOGIN_CHALLENGE_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class InvalidLoginChallengeError extends LoginChallengeError {
  readonly code = 'LOGIN_CHALLENGE_INVALID_TOKEN';

  constructor() {
    super('Invalid login challenge');
  }
}
