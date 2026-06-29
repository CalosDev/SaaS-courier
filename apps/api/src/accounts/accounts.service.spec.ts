import {
  InvalidActivationTokenError,
  InvalidAccountInputError,
  InvalidPasswordError,
} from './account.errors';
import type {
  ActivateAccountRecord,
  ActivationTokenSecret,
  CreateInvitedUserRecord,
  InvitedUserRecord,
  UserAccountRecord,
} from './account.types';
import { AccountsService } from './accounts.service';

function buildUserAccountRecord(
  overrides: Partial<UserAccountRecord> = {},
): UserAccountRecord {
  const now = new Date('2026-06-29T00:00:00.000Z');

  return {
    id: '72d81947-9dcc-4c66-a057-6b7f5314b4bf',
    email: 'invited.user@courier.test',
    status: 'INVITED',
    emailVerifiedAt: null,
    passwordChangedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function buildInvitedUserRecord(
  overrides: Partial<InvitedUserRecord> = {},
): InvitedUserRecord {
  const expiresAt = new Date('2026-06-30T00:00:00.000Z');

  return {
    user: buildUserAccountRecord(),
    expiresAt,
    ...overrides,
  };
}

describe('AccountsService', () => {
  const repository = {
    inviteUser: jest.fn<
      Promise<InvitedUserRecord>,
      [CreateInvitedUserRecord]
    >(),
    activateAccount: jest.fn<
      Promise<UserAccountRecord>,
      [ActivateAccountRecord]
    >(),
  };
  const passwordHasher = {
    hash: jest.fn<Promise<string>, [string]>(),
    verify: jest.fn<Promise<boolean>, [string, string]>(),
  };
  const activationTokenService = {
    createSecret: jest.fn<ActivationTokenSecret, []>(),
    hashToken: jest.fn<string, [string]>(),
  };

  const service = new AccountsService(
    repository,
    passwordHasher,
    activationTokenService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes the email before inviting a user', async () => {
    repository.inviteUser.mockResolvedValueOnce(buildInvitedUserRecord());
    activationTokenService.createSecret.mockReturnValueOnce({
      token: 'activation-secret-value',
      tokenHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    await service.inviteUser({
      email: '  Invited.User@Courier.Test  ',
    });

    expect(repository.inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invited.user@courier.test',
      }),
    );
  });

  it('rejects an empty email', async () => {
    await expect(
      service.inviteUser({
        email: '   ',
      }),
    ).rejects.toBeInstanceOf(InvalidAccountInputError);
  });

  it('passes tokenHash and never the raw token to the repository', async () => {
    repository.inviteUser.mockResolvedValueOnce(buildInvitedUserRecord());
    activationTokenService.createSecret.mockReturnValueOnce({
      token: 'raw-activation-secret',
      tokenHash:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });

    await service.inviteUser({
      email: 'invited.user@courier.test',
    });

    expect(repository.inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash:
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    );
    expect(repository.inviteUser.mock.calls[0]?.[0]).not.toHaveProperty(
      'token',
    );
  });

  it('uses a 24 hour expiration window for the activation token', async () => {
    repository.inviteUser.mockResolvedValueOnce(buildInvitedUserRecord());
    activationTokenService.createSecret.mockReturnValueOnce({
      token: 'raw-activation-secret',
      tokenHash:
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    });

    const beforeInvite = Date.now();
    await service.inviteUser({
      email: 'invited.user@courier.test',
    });
    const afterInvite = Date.now();

    const expiresAt = repository.inviteUser.mock.calls[0]?.[0].expiresAt;

    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime() - beforeInvite).toBeGreaterThanOrEqual(
      24 * 60 * 60 * 1000 - 5_000,
    );
    expect(expiresAt.getTime() - afterInvite).toBeLessThanOrEqual(
      24 * 60 * 60 * 1000 + 5_000,
    );
  });

  it('does not expose passwordHash in inviteUser results', async () => {
    repository.inviteUser.mockResolvedValueOnce(buildInvitedUserRecord());
    activationTokenService.createSecret.mockReturnValueOnce({
      token: 'raw-activation-secret',
      tokenHash:
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    });

    const invitedUser = await service.inviteUser({
      email: 'invited.user@courier.test',
    });

    expect(invitedUser.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a password shorter than 12 characters', async () => {
    await expect(
      service.activateAccount({
        activationToken: 'activation-secret',
        password: 'short-pass',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it('rejects a password longer than 128 characters', async () => {
    await expect(
      service.activateAccount({
        activationToken: 'activation-secret',
        password: 'a'.repeat(129),
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it('rejects passwords containing the NUL character', async () => {
    await expect(
      service.activateAccount({
        activationToken: 'activation-secret',
        password: 'valid-password\u0000',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it('does not normalize or modify the password before hashing', async () => {
    const activatedUser = buildUserAccountRecord({
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
      passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
    });
    passwordHasher.hash.mockResolvedValueOnce('$argon2id$hash');
    activationTokenService.hashToken.mockReturnValueOnce(
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    );
    repository.activateAccount.mockResolvedValueOnce(activatedUser);

    await service.activateAccount({
      activationToken: 'activation-secret',
      password: '  Exact Password  ',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('  Exact Password  ');
  });

  it('uses the hash of the activation secret when activating', async () => {
    const activatedUser = buildUserAccountRecord({
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
      passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
    });
    passwordHasher.hash.mockResolvedValueOnce('$argon2id$hash');
    activationTokenService.hashToken.mockReturnValueOnce(
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    );
    repository.activateAccount.mockResolvedValueOnce(activatedUser);

    await service.activateAccount({
      activationToken: 'activation-secret',
      password: '0123456789AB',
    });

    expect(repository.activateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash:
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      }),
    );
  });

  it('does not expose passwordHash in activateAccount results', async () => {
    const activatedUser = buildUserAccountRecord({
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
      passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
    });
    passwordHasher.hash.mockResolvedValueOnce('$argon2id$hash');
    activationTokenService.hashToken.mockReturnValueOnce(
      '1212121212121212121212121212121212121212121212121212121212121212',
    );
    repository.activateAccount.mockResolvedValueOnce(activatedUser);

    const account = await service.activateAccount({
      activationToken: 'activation-secret',
      password: '0123456789AB',
    });

    expect(account).not.toHaveProperty('passwordHash');
  });

  it('propagates invalid activation token errors safely', async () => {
    passwordHasher.hash.mockResolvedValueOnce('$argon2id$hash');
    activationTokenService.hashToken.mockReturnValueOnce(
      '3434343434343434343434343434343434343434343434343434343434343434',
    );
    repository.activateAccount.mockRejectedValueOnce(
      new InvalidActivationTokenError(),
    );

    await expect(
      service.activateAccount({
        activationToken: 'activation-secret',
        password: '0123456789AB',
      }),
    ).rejects.toBeInstanceOf(InvalidActivationTokenError);
  });
});
