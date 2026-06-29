import { Injectable } from '@nestjs/common';

import type { FailedAuthenticationState } from './auth.types';

const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;
const SIXTY_MINUTES_IN_MS = 60 * 60 * 1000;

@Injectable()
export class LoginLockoutPolicy {
  isLocked(lockedUntil: Date | null, now: Date): boolean {
    return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
  }

  calculateNextFailureState(input: {
    currentFailedLoginAttempts: number;
    currentLockedUntil: Date | null;
    occurredAt: Date;
  }): FailedAuthenticationState {
    const failedLoginAttempts = input.currentFailedLoginAttempts + 1;
    const currentLock = this.isLocked(
      input.currentLockedUntil,
      input.occurredAt,
    )
      ? input.currentLockedUntil
      : null;
    const lockDurationInMs = this.getLockDurationInMs(failedLoginAttempts);

    if (lockDurationInMs === null) {
      return {
        failedLoginAttempts,
        lockedUntil: currentLock,
      };
    }

    const candidateLockedUntil = new Date(
      input.occurredAt.getTime() + lockDurationInMs,
    );

    if (
      currentLock !== null &&
      currentLock.getTime() > candidateLockedUntil.getTime()
    ) {
      return {
        failedLoginAttempts,
        lockedUntil: currentLock,
      };
    }

    return {
      failedLoginAttempts,
      lockedUntil: candidateLockedUntil,
    };
  }

  private getLockDurationInMs(failedLoginAttempts: number): number | null {
    if (failedLoginAttempts >= 15) {
      return SIXTY_MINUTES_IN_MS;
    }

    if (failedLoginAttempts >= 10) {
      return FIFTEEN_MINUTES_IN_MS;
    }

    if (failedLoginAttempts >= 5) {
      return FIVE_MINUTES_IN_MS;
    }

    return null;
  }
}
