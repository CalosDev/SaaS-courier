import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_ACTIVITY_REFRESH_INTERVAL_MS,
  SESSION_IDLE_TTL_MS,
} from './session.constants';
import {
  InvalidSessionInputError,
  InvalidSessionTokenError,
  SessionCreationDeniedError,
} from './session.errors';
import { SessionTokenService } from './session-token.service';
import { SessionsRepository } from './sessions.repository';
import type {
  AdministrativeSessionRevocationReason,
  CreateSessionInput,
  CreatedSessionResult,
  RevokeAllUserSessionsInput,
  RevokeEmployeeSessionsInput,
  RevokeSessionInput,
  RotateSessionInput,
  RotatedSessionResult,
  SessionContext,
  ValidateSessionInput,
} from './session.types';

@Injectable()
export class SessionsService {
  constructor(
    @Inject(SessionsRepository)
    private readonly sessionsRepository: SessionsRepository,
    private readonly sessionTokenService: SessionTokenService,
  ) {}

  async createSession(
    input: CreateSessionInput,
  ): Promise<CreatedSessionResult> {
    const userId = this.normalizeRequiredString(input.userId, 'userId');
    const organizationId = this.normalizeRequiredString(
      input.organizationId,
      'organizationId',
    );
    const principal = await this.sessionsRepository.findSessionCreationContext(
      userId,
      organizationId,
    );

    if (!principal) {
      throw new SessionCreationDeniedError();
    }

    const secret = this.sessionTokenService.createSecret();
    const now = new Date();
    const sessionId = randomUUID();
    const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
    const session = await this.sessionsRepository.createSessionRecord({
      sessionId,
      familyId: sessionId,
      tokenHash: secret.tokenHash,
      expiresAt,
      lastSeenAt: now,
      ipAddress: this.normalizeOptionalString(input.ipAddress),
      userAgent: this.normalizeOptionalString(input.userAgent),
      principal,
    });

    return {
      sessionToken: secret.token,
      session,
    };
  }

  async validateSession(input: ValidateSessionInput): Promise<SessionContext> {
    const sessionToken = this.normalizeSessionToken(input.sessionToken);
    const now = new Date();
    const result = await this.sessionsRepository.validateSessionRecord({
      tokenHash: this.sessionTokenService.hashToken(sessionToken),
      evaluatedAt: now,
      idleExpiresBefore: new Date(now.getTime() - SESSION_IDLE_TTL_MS),
      refreshLastSeenBefore: new Date(
        now.getTime() - SESSION_ACTIVITY_REFRESH_INTERVAL_MS,
      ),
    });

    if (result.status !== 'valid') {
      throw new InvalidSessionTokenError();
    }

    return result.session;
  }

  async rotateSession(
    input: RotateSessionInput,
  ): Promise<RotatedSessionResult> {
    const sessionToken = this.normalizeSessionToken(input.sessionToken);
    const newSecret = this.sessionTokenService.createSecret();
    const now = new Date();
    const result = await this.sessionsRepository.rotateSessionRecord({
      currentTokenHash: this.sessionTokenService.hashToken(sessionToken),
      newSessionId: randomUUID(),
      newTokenHash: newSecret.tokenHash,
      rotatedAt: now,
      idleExpiresBefore: new Date(now.getTime() - SESSION_IDLE_TTL_MS),
      ipAddress: this.normalizeOptionalString(input.ipAddress),
      userAgent: this.normalizeOptionalString(input.userAgent),
    });

    if (result.status !== 'rotated') {
      throw new InvalidSessionTokenError();
    }

    return {
      sessionToken: newSecret.token,
      session: result.session,
    };
  }

  async revokeSession(input: RevokeSessionInput): Promise<void> {
    const sessionToken = this.normalizeSessionToken(input.sessionToken);

    await this.sessionsRepository.revokeSessionRecord({
      tokenHash: this.sessionTokenService.hashToken(sessionToken),
      revokedAt: new Date(),
      reason: 'LOGOUT',
    });
  }

  async revokeAllUserSessions(
    input: RevokeAllUserSessionsInput,
  ): Promise<number> {
    const userId = this.normalizeRequiredString(input.userId, 'userId');
    const reason = this.assertAdministrativeReason(input.reason);

    return this.sessionsRepository.revokeAllUserSessionsRecord({
      userId,
      revokedAt: new Date(),
      reason,
    });
  }

  async revokeEmployeeSessions(
    input: RevokeEmployeeSessionsInput,
  ): Promise<number> {
    const organizationId = this.normalizeRequiredString(
      input.organizationId,
      'organizationId',
    );
    const employeeId = this.normalizeRequiredString(
      input.employeeId,
      'employeeId',
    );
    const reason = this.assertAdministrativeReason(input.reason);

    return this.sessionsRepository.revokeEmployeeSessionsRecord({
      organizationId,
      employeeId,
      revokedAt: new Date(),
      reason,
    });
  }

  private normalizeSessionToken(sessionToken: string): string {
    if (typeof sessionToken !== 'string') {
      throw new InvalidSessionInputError(
        'Invalid session input: sessionToken is required',
      );
    }

    this.sessionTokenService.assertValidTokenFormat(sessionToken);

    return sessionToken;
  }

  private normalizeRequiredString(value: string, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new InvalidSessionInputError(
        `Invalid session input: ${fieldName} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidSessionInputError(
        `Invalid session input: ${fieldName} is required`,
      );
    }

    return normalizedValue;
  }

  private normalizeOptionalString(value?: string): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue ? normalizedValue : null;
  }

  private assertAdministrativeReason(
    reason: string,
  ): AdministrativeSessionRevocationReason {
    if (reason === 'ADMIN_REVOKED' || reason === 'ACCOUNT_CHANGED') {
      return reason;
    }

    throw new InvalidSessionInputError(
      'Invalid session input: reason is not allowed',
    );
  }
}
