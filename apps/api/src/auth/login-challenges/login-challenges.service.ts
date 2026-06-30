import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  InvalidLoginChallengeError,
  InvalidLoginChallengeInputError,
} from './login-challenge.errors';
import { LoginChallengeTokenService } from './login-challenge-token.service';
import { LoginChallengesRepository } from './login-challenges.repository';
import type {
  ConsumedLoginChallengeResult,
  ConsumeLoginChallengeInput,
  CreateLoginChallengeInput,
  CreatedLoginChallengeResult,
} from './login-challenge.types';

const LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class LoginChallengesService {
  constructor(
    @Inject(LoginChallengesRepository)
    private readonly loginChallengesRepository: LoginChallengesRepository,
    private readonly loginChallengeTokenService: LoginChallengeTokenService,
  ) {}

  async createChallenge(
    input: CreateLoginChallengeInput,
  ): Promise<CreatedLoginChallengeResult> {
    const userId = this.normalizeRequiredString(input.userId, 'userId');
    const secret = this.loginChallengeTokenService.createSecret();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + LOGIN_CHALLENGE_TTL_MS);

    await this.loginChallengesRepository.createLoginChallengeRecord({
      challengeId: randomUUID(),
      userId,
      tokenHash: secret.tokenHash,
      createdAt,
      expiresAt,
      invalidatedAt: createdAt,
    });

    return {
      token: secret.token,
      expiresAt,
    };
  }

  async consumeChallenge(
    input: ConsumeLoginChallengeInput,
  ): Promise<ConsumedLoginChallengeResult> {
    const challengeToken = this.normalizeRequiredString(
      input.challengeToken,
      'challengeToken',
    );
    this.loginChallengeTokenService.assertValidTokenFormat(challengeToken);

    const result =
      await this.loginChallengesRepository.consumeLoginChallengeRecord({
        tokenHash: this.loginChallengeTokenService.hashToken(challengeToken),
        consumedAt: new Date(),
      });

    if (result.status !== 'consumed') {
      throw new InvalidLoginChallengeError();
    }

    return {
      userId: result.userId,
    };
  }

  private normalizeRequiredString(value: string, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new InvalidLoginChallengeInputError(
        `Invalid login challenge input: ${fieldName} is required`,
      );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidLoginChallengeInputError(
        `Invalid login challenge input: ${fieldName} is required`,
      );
    }

    return normalizedValue;
  }
}
