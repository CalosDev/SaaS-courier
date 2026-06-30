import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const CSRF_TOKEN_PATTERN = /^cf1\.[A-Za-z0-9_-]{43}$/;

@Injectable()
export class CsrfTokenService {
  createToken(): string {
    return `cf1.${randomBytes(32).toString('base64url')}`;
  }

  isValidTokenFormat(token: string): boolean {
    return CSRF_TOKEN_PATTERN.test(token);
  }

  tokensMatch(cookieToken: string, headerToken: string): boolean {
    if (
      !this.isValidTokenFormat(cookieToken) ||
      !this.isValidTokenFormat(headerToken)
    ) {
      return false;
    }

    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);

    if (cookieBuffer.length !== headerBuffer.length) {
      return false;
    }

    return timingSafeEqual(cookieBuffer, headerBuffer);
  }
}
