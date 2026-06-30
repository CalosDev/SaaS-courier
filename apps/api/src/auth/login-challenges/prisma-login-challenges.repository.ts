import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginChallengesRepository } from './login-challenges.repository';
import type {
  ConsumeLoginChallengeRecordInput,
  CreateLoginChallengeRecordInput,
  LoginChallengeConsumeRecordResult,
} from './login-challenge.types';

type LockedUserRow = {
  id: string;
};

type ConsumedChallengeRow = {
  user_id: string;
};

@Injectable()
export class PrismaLoginChallengesRepository implements LoginChallengesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async createLoginChallengeRecord(
    input: CreateLoginChallengeRecordInput,
  ): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      const lockedUsers = await tx.$queryRaw<LockedUserRow[]>(Prisma.sql`
        SELECT id
        FROM users
        WHERE id = ${input.userId}::uuid
        FOR UPDATE
      `);

      if (!lockedUsers[0]) {
        throw new Error('Cannot create login challenge for a missing user');
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE login_challenges
        SET invalidated_at = ${input.invalidatedAt}::timestamptz
        WHERE user_id = ${input.userId}::uuid
          AND consumed_at IS NULL
          AND invalidated_at IS NULL
      `);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO login_challenges (
          id,
          user_id,
          token_hash,
          expires_at,
          created_at
        )
        VALUES (
          ${input.challengeId}::uuid,
          ${input.userId}::uuid,
          ${input.tokenHash},
          ${input.expiresAt}::timestamptz,
          ${input.createdAt}::timestamptz
        )
      `);
    });
  }

  async consumeLoginChallengeRecord(
    input: ConsumeLoginChallengeRecordInput,
  ): Promise<LoginChallengeConsumeRecordResult> {
    const rows = await this.prismaService.$queryRaw<
      ConsumedChallengeRow[]
    >(Prisma.sql`
        UPDATE login_challenges
        SET consumed_at = ${input.consumedAt}::timestamptz
        WHERE token_hash = ${input.tokenHash}
          AND consumed_at IS NULL
          AND invalidated_at IS NULL
          AND expires_at > ${input.consumedAt}::timestamptz
        RETURNING user_id
      `);

    const row = rows[0];

    if (!row) {
      return {
        status: 'invalid',
      };
    }

    return {
      status: 'consumed',
      userId: row.user_id,
    };
  }
}
