import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import {
  SESSION_TOKEN_PATTERN,
  SESSION_TOKEN_PREFIX,
  SESSION_TOKEN_RANDOM_BYTES,
} from './session.constants';
import { InvalidSessionInputError } from './session.errors';
import type { SessionTokenSecret } from './session.types';

@Injectable()
export class SessionTokenService {
  createSecret(): SessionTokenSecret {
    const token = `${SESSION_TOKEN_PREFIX}${randomBytes(
      SESSION_TOKEN_RANDOM_BYTES,
    ).toString('base64url')}`;

    return {
      token,
      tokenHash: this.hashToken(token),
    };
  }

  assertValidTokenFormat(sessionToken: string): void {
    if (
      typeof sessionToken !== 'string' ||
      !SESSION_TOKEN_PATTERN.test(sessionToken)
    ) {
      throw new InvalidSessionInputError(
        'Invalid session input: sessionToken format is invalid',
      );
    }
  }

  hashToken(sessionToken: string): string {
    return createHash('sha256').update(sessionToken).digest('hex');
  }
}
