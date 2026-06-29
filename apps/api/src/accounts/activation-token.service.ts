import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import type { ActivationTokenSecret } from './account.types';

@Injectable()
export class ActivationTokenService {
  createSecret(): ActivationTokenSecret {
    const token = randomBytes(32).toString('base64url');

    return {
      token,
      tokenHash: this.hashToken(token),
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
