import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import {
  InvalidActivationTokenError,
  UserEmailConflictError,
} from '../src/accounts/account.errors';
import { AccountsService } from '../src/accounts/accounts.service';
import { PasswordHasher } from '../src/accounts/password-hasher';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Accounts integration', () => {
  it('invites and activates a user securely without leaving sessions or test data behind', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      tokenIds: [] as string[],
      userIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const accountsService = moduleRef.get<AccountsService>(AccountsService);
      const passwordHasher = moduleRef.get<PasswordHasher>(PasswordHasher);
      prismaService = moduleRef.get<PrismaService>(PrismaService);

      const invited = await accountsService.inviteUser({
        email: '  invited.user@courier.test  ',
      });

      cleanup.userIds.push(invited.user.id);

      expect(invited.user.status).toBe('INVITED');
      expect(invited.user.email).toBe('invited.user@courier.test');
      expect(invited.user.passwordChangedAt).toBeNull();
      expect(invited.user.emailVerifiedAt).toBeNull();
      expect(invited.expiresAt).toBeInstanceOf(Date);
      expect(invited.activationToken).toBeTruthy();

      const persistedToken =
        await prismaService.userActivationToken.findFirstOrThrow({
          where: {
            userId: invited.user.id,
          },
        });
      cleanup.tokenIds.push(persistedToken.id);

      expect(persistedToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(persistedToken.tokenHash).not.toBe(invited.activationToken);
      expect(persistedToken.consumedAt).toBeNull();
      expect(persistedToken.invalidatedAt).toBeNull();

      const activated = await accountsService.activateAccount({
        activationToken: invited.activationToken,
        password: 'Correct Horse Battery Staple',
      });

      expect(activated.status).toBe('ACTIVE');
      expect(activated.emailVerifiedAt).toBeInstanceOf(Date);
      expect(activated.passwordChangedAt).toBeInstanceOf(Date);

      const persistedUser = await prismaService.user.findUniqueOrThrow({
        where: {
          id: invited.user.id,
        },
      });

      expect(persistedUser.passwordHash?.startsWith('$argon2id$')).toBe(true);
      await expect(
        passwordHasher.verify(
          'Correct Horse Battery Staple',
          persistedUser.passwordHash ?? '',
        ),
      ).resolves.toBe(true);

      const consumedToken =
        await prismaService.userActivationToken.findUniqueOrThrow({
          where: {
            id: persistedToken.id,
          },
        });

      expect(consumedToken.consumedAt).toBeInstanceOf(Date);
      expect(consumedToken.invalidatedAt).toBeNull();

      await expect(
        accountsService.activateAccount({
          activationToken: invited.activationToken,
          password: 'Another Correct Password',
        }),
      ).rejects.toBeInstanceOf(InvalidActivationTokenError);

      await expect(
        accountsService.activateAccount({
          activationToken: 'nonexistent-token',
          password: 'Another Correct Password',
        }),
      ).rejects.toBeInstanceOf(InvalidActivationTokenError);

      await expect(
        accountsService.inviteUser({
          email: 'invited.user@courier.test',
        }),
      ).rejects.toBeInstanceOf(UserEmailConflictError);

      const expiredUser = await accountsService.inviteUser({
        email: 'expired.user@courier.test',
      });
      cleanup.userIds.push(expiredUser.user.id);

      const expiredTokenRecord =
        await prismaService.userActivationToken.findFirstOrThrow({
          where: {
            userId: expiredUser.user.id,
          },
        });
      cleanup.tokenIds.push(expiredTokenRecord.id);

      await prismaService.userActivationToken.update({
        where: {
          id: expiredTokenRecord.id,
        },
        data: {
          createdAt: new Date('2026-06-27T00:00:00.000Z'),
          expiresAt: new Date('2026-06-28T00:00:00.000Z'),
        },
      });

      await expect(
        accountsService.activateAccount({
          activationToken: expiredUser.activationToken,
          password: 'Correct Horse Battery Staple',
        }),
      ).rejects.toBeInstanceOf(InvalidActivationTokenError);

      const sessionCount = await prismaService.userSession.count();

      expect(sessionCount).toBe(0);
    } finally {
      if (prismaService) {
        for (const tokenId of cleanup.tokenIds) {
          await prismaService.userActivationToken.deleteMany({
            where: {
              id: tokenId,
            },
          });
        }

        for (const userId of cleanup.userIds) {
          await prismaService.user.deleteMany({
            where: {
              id: userId,
            },
          });
        }
      }

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  });
});
