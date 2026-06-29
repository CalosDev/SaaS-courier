import { Inject, Injectable } from '@nestjs/common';

import { PasswordHasher } from '../accounts/password-hasher';
import {
  AccountTemporarilyLockedError,
  InvalidAuthenticationInputError,
  InvalidCredentialsError,
  OrganizationAccessDeniedError,
} from './auth.errors';
import { DUMMY_PASSWORD_HASH } from './auth.constants';
import { AuthRepository } from './auth.repository';
import type {
  AuthenticateCredentialsInput,
  AuthenticatedUserResult,
  AuthenticationUserRecord,
  OrganizationContext,
  SelectOrganizationInput,
} from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository)
    private readonly authRepository: AuthRepository,
    @Inject(PasswordHasher)
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async authenticateCredentials(
    input: AuthenticateCredentialsInput,
  ): Promise<AuthenticatedUserResult> {
    const email = this.normalizeEmail(input.email);
    const password = this.validatePassword(input.password);
    const user = await this.authRepository.findUserByEmail(email);
    const now = new Date();

    if (!user) {
      await this.performDummyPasswordVerification(password);
      throw new InvalidCredentialsError();
    }

    if (this.isLocked(user, now)) {
      throw new AccountTemporarilyLockedError();
    }

    if (!this.canAuthenticate(user)) {
      await this.performDummyPasswordVerification(password);
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.verify(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      const failureState =
        await this.authRepository.registerFailedAuthenticationAttempt({
          userId: user.userId,
          occurredAt: now,
        });

      if (failureState?.lockedUntil && failureState.lockedUntil > now) {
        throw new AccountTemporarilyLockedError();
      }

      throw new InvalidCredentialsError();
    }

    const successState =
      await this.authRepository.registerSuccessfulAuthentication({
        userId: user.userId,
        authenticatedAt: now,
      });

    if (!successState) {
      throw new InvalidCredentialsError();
    }

    if (successState.blocked) {
      throw new AccountTemporarilyLockedError();
    }

    const organizations =
      await this.authRepository.findAvailableOrganizationsForUser(user.userId);

    return {
      userId: user.userId,
      email: user.email,
      organizations,
    };
  }

  async selectOrganization(
    input: SelectOrganizationInput,
  ): Promise<OrganizationContext> {
    const userId = this.normalizeIdentifier(input.userId, 'userId');
    const organizationId = this.normalizeIdentifier(
      input.organizationId,
      'organizationId',
    );

    const context = await this.authRepository.findOrganizationContext(
      userId,
      organizationId,
    );

    if (!context) {
      throw new OrganizationAccessDeniedError();
    }

    return context;
  }

  private normalizeEmail(email: string): string {
    if (typeof email !== 'string') {
      throw new InvalidAuthenticationInputError(
        'Invalid authentication input: email is required',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new InvalidAuthenticationInputError(
        'Invalid authentication input: email is required',
      );
    }

    return normalizedEmail;
  }

  private validatePassword(password: string): string {
    if (typeof password !== 'string') {
      throw new InvalidAuthenticationInputError(
        'Invalid authentication input: password is required',
      );
    }

    return password;
  }

  private normalizeIdentifier(value: string, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new InvalidAuthenticationInputError(
        `Invalid authentication input: ${fieldName} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidAuthenticationInputError(
        `Invalid authentication input: ${fieldName} is required`,
      );
    }

    return normalizedValue;
  }

  private canAuthenticate(
    user: AuthenticationUserRecord,
  ): user is AuthenticationUserRecord & { passwordHash: string } {
    return (
      user.status === 'ACTIVE' &&
      user.deletedAt === null &&
      user.emailVerifiedAt !== null &&
      typeof user.passwordHash === 'string' &&
      user.passwordHash.length > 0
    );
  }

  private isLocked(user: AuthenticationUserRecord, now: Date): boolean {
    return (
      user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime()
    );
  }

  private async performDummyPasswordVerification(
    password: string,
  ): Promise<void> {
    await this.passwordHasher.verify(password, DUMMY_PASSWORD_HASH);
  }
}
