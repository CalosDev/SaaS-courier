import { Injectable } from '@nestjs/common';

import type { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvalidActivationTokenError,
  UserEmailConflictError,
} from './account.errors';
import type {
  ActivateAccountRecord,
  CreateInvitedUserRecord,
  InvitedUserRecord,
  UserAccountRecord,
} from './account.types';
import { AccountsRepository } from './accounts.repository';

@Injectable()
export class PrismaAccountsRepository implements AccountsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async inviteUser(input: CreateInvitedUserRecord): Promise<InvitedUserRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            status: 'INVITED',
            passwordHash: null,
          },
        });

        await tx.userActivationToken.create({
          data: {
            userId: user.id,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          },
        });

        return {
          user: this.toUserAccountRecord(user),
          expiresAt: input.expiresAt,
        };
      });
    } catch (error) {
      if (this.isUserEmailConflictError(error)) {
        throw new UserEmailConflictError(input.email);
      }

      throw error;
    }
  }

  async activateAccount(
    input: ActivateAccountRecord,
  ): Promise<UserAccountRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const activationToken = await tx.userActivationToken.findFirst({
        where: {
          tokenHash: input.tokenHash,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: {
            gt: input.activatedAt,
          },
          user: {
            deletedAt: null,
            status: 'INVITED',
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!activationToken) {
        throw new InvalidActivationTokenError();
      }

      const userUpdateResult = await tx.user.updateMany({
        where: {
          id: activationToken.userId,
          deletedAt: null,
          status: 'INVITED',
        },
        data: {
          passwordHash: input.passwordHash,
          passwordChangedAt: input.activatedAt,
          emailVerifiedAt: input.activatedAt,
          status: 'ACTIVE',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      if (userUpdateResult.count !== 1) {
        throw new InvalidActivationTokenError();
      }

      const tokenUpdateResult = await tx.userActivationToken.updateMany({
        where: {
          id: activationToken.id,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: {
            gt: input.activatedAt,
          },
        },
        data: {
          consumedAt: input.activatedAt,
        },
      });

      if (tokenUpdateResult.count !== 1) {
        throw new InvalidActivationTokenError();
      }

      const user = await tx.user.findUniqueOrThrow({
        where: {
          id: activationToken.userId,
        },
      });

      return this.toUserAccountRecord(user);
    });
  }

  private isUserEmailConflictError(error: unknown): boolean {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    const target = prismaError.meta?.target;
    const modelName = prismaError.meta?.modelName;

    if (modelName !== 'User') {
      return false;
    }

    if (Array.isArray(target)) {
      return target.some(
        (entry) =>
          typeof entry === 'string' &&
          (entry.includes('email') || entry.includes('users_email_key')),
      );
    }

    if (typeof target === 'string') {
      return target.includes('email') || target.includes('users_email_key');
    }

    return true;
  }

  private toUserAccountRecord(user: User): UserAccountRecord {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}
