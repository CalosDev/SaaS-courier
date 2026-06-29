import { Inject, Injectable } from '@nestjs/common';

import {
  InvalidActivationTokenError,
  InvalidAccountInputError,
  InvalidPasswordError,
} from './account.errors';
import { ActivationTokenService } from './activation-token.service';
import type {
  ActivateAccountInput,
  ActivateAccountRecord,
  CreateInvitedUserRecord,
  InviteUserInput,
  InviteUserResult,
  UserAccountRecord,
} from './account.types';
import { AccountsRepository } from './accounts.repository';
import { PasswordHasher } from './password-hasher';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AccountsService {
  constructor(
    @Inject(AccountsRepository)
    private readonly accountsRepository: AccountsRepository,
    @Inject(PasswordHasher)
    private readonly passwordHasher: PasswordHasher,
    private readonly activationTokenService: ActivationTokenService,
  ) {}

  async inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
    const email = this.normalizeEmail(input.email);
    const activationSecret = this.activationTokenService.createSecret();
    const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

    const record: CreateInvitedUserRecord = {
      email,
      tokenHash: activationSecret.tokenHash,
      expiresAt,
    };

    const invitedUser = await this.accountsRepository.inviteUser(record);

    return {
      user: invitedUser.user,
      activationToken: activationSecret.token,
      expiresAt: invitedUser.expiresAt,
    };
  }

  async activateAccount(
    input: ActivateAccountInput,
  ): Promise<UserAccountRecord> {
    this.validatePassword(input.password);

    if (!input.activationToken) {
      throw new InvalidActivationTokenError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const tokenHash = this.activationTokenService.hashToken(
      input.activationToken,
    );
    const activatedAt = new Date();

    const record: ActivateAccountRecord = {
      tokenHash,
      passwordHash,
      activatedAt,
    };

    return this.accountsRepository.activateAccount(record);
  }

  private normalizeEmail(email: string): string {
    if (typeof email !== 'string') {
      throw new InvalidAccountInputError(
        'Invalid account input: email is required',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new InvalidAccountInputError(
        'Invalid account input: email is required',
      );
    }

    return normalizedEmail;
  }

  private validatePassword(password: string): void {
    if (typeof password !== 'string') {
      throw new InvalidPasswordError('Invalid password: password is required');
    }

    if (password.includes('\u0000')) {
      throw new InvalidPasswordError(
        'Invalid password: NUL characters are not allowed',
      );
    }

    const passwordLength = Array.from(password).length;

    if (passwordLength < MIN_PASSWORD_LENGTH) {
      throw new InvalidPasswordError(
        `Invalid password: minimum length is ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    if (passwordLength > MAX_PASSWORD_LENGTH) {
      throw new InvalidPasswordError(
        `Invalid password: maximum length is ${MAX_PASSWORD_LENGTH} characters`,
      );
    }
  }
}
