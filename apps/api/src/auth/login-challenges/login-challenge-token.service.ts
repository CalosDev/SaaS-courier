import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { InvalidLoginChallengeInputError } from './login-challenge.errors';
import type { LoginChallengeTokenSecret } from './login-challenge.types';

const LOGIN_CHALLENGE_PREFIX = 'lc1.';
const LOGIN_CHALLENGE_PATTERN = /^lc1\.[A-Za-z0-9_-]{43}$/;

@Injectable()
export class LoginChallengeTokenService {
  createSecret(): LoginChallengeTokenSecret {
    const secret = randomBytes(32).toString('base64url');
    const token = `${LOGIN_CHALLENGE_PREFIX}${secret}`;

    return {
      token,
      tokenHash: this.hashToken(token),
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  assertValidTokenFormat(token: string): void {
    if (!LOGIN_CHALLENGE_PATTERN.test(token)) {
      throw new InvalidLoginChallengeInputError(
        'Invalid login challenge input: challengeToken format is invalid',
      );
    }
  }
}
