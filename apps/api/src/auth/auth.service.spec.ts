import { PasswordHasher } from '../accounts/password-hasher';
import {
  AccountTemporarilyLockedError,
  InvalidAuthenticationInputError,
  InvalidCredentialsError,
  OrganizationAccessDeniedError,
} from './auth.errors';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type {
  AuthenticationMembership,
  AuthenticationUserRecord,
  OrganizationContext,
} from './auth.types';

function buildUserRecord(
  overrides: Partial<AuthenticationUserRecord> = {},
): AuthenticationUserRecord {
  return {
    userId: 'f5b65037-5a06-4545-8f0b-049b2b8ee8ee',
    email: 'agent@courier.test',
    passwordHash: '$argon2id$stored-hash',
    emailVerifiedAt: new Date('2026-06-28T12:00:00.000Z'),
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function buildMembership(
  overrides: Partial<AuthenticationMembership> = {},
): AuthenticationMembership {
  return {
    organizationId: '1b5cdf33-6d50-4a91-ae66-6103bca9020f',
    organizationSlug: 'courier-central',
    organizationName: 'Courier Central',
    organizationStatus: 'ACTIVE',
    employeeId: '272c26f3-6c88-43a5-91b2-31bf9088b10d',
    employeeCode: 'EMP-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    facilityIds: ['f-1', 'f-2'],
    primaryFacilityId: 'f-1',
    ...overrides,
  };
}

function buildOrganizationContext(
  overrides: Partial<OrganizationContext> = {},
): OrganizationContext {
  return {
    userId: 'f5b65037-5a06-4545-8f0b-049b2b8ee8ee',
    email: 'agent@courier.test',
    organizationId: '1b5cdf33-6d50-4a91-ae66-6103bca9020f',
    organizationSlug: 'courier-central',
    organizationName: 'Courier Central',
    employeeId: '272c26f3-6c88-43a5-91b2-31bf9088b10d',
    employeeCode: 'EMP-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    facilityIds: ['f-1', 'f-2'],
    primaryFacilityId: 'f-1',
    ...overrides,
  };
}

describe('AuthService', () => {
  const findUserByEmailMock = jest.fn();
  const registerFailedAuthenticationAttemptMock = jest.fn();
  const registerSuccessfulAuthenticationMock = jest.fn();
  const findAvailableOrganizationsForUserMock = jest.fn();
  const findOrganizationContextMock = jest.fn();
  const repository: jest.Mocked<AuthRepository> = {
    findUserByEmail: findUserByEmailMock,
    registerFailedAuthenticationAttempt:
      registerFailedAuthenticationAttemptMock,
    registerSuccessfulAuthentication: registerSuccessfulAuthenticationMock,
    findAvailableOrganizationsForUser: findAvailableOrganizationsForUserMock,
    findOrganizationContext: findOrganizationContextMock,
  };
  const hashMock = jest.fn();
  const verifyMock = jest.fn();
  const passwordHasher: jest.Mocked<PasswordHasher> = {
    hash: hashMock,
    verify: verifyMock,
  };

  const service = new AuthService(repository, passwordHasher);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes email and preserves password exactly as received', async () => {
    findUserByEmailMock.mockResolvedValueOnce(buildUserRecord());
    verifyMock.mockResolvedValueOnce(true);
    registerSuccessfulAuthenticationMock.mockResolvedValueOnce({
      blocked: false,
      lockedUntil: null,
    });
    findAvailableOrganizationsForUserMock.mockResolvedValueOnce([
      buildMembership(),
    ]);

    await service.authenticateCredentials({
      email: '  AGENT@Courier.Test  ',
      password: '  Exact Password  ',
    });

    expect(findUserByEmailMock).toHaveBeenCalledWith('agent@courier.test');
    expect(verifyMock).toHaveBeenCalledWith(
      '  Exact Password  ',
      '$argon2id$stored-hash',
    );
  });

  it('rejects an empty email', async () => {
    await expect(
      service.authenticateCredentials({
        email: '   ',
        password: 'does-not-matter',
      }),
    ).rejects.toBeInstanceOf(InvalidAuthenticationInputError);
  });

  it('uses a dummy verification path for an unknown email', async () => {
    findUserByEmailMock.mockResolvedValueOnce(null);
    verifyMock.mockResolvedValueOnce(false);

    await expect(
      service.authenticateCredentials({
        email: 'missing@courier.test',
        password: 'Unknown Password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(registerFailedAuthenticationAttemptMock).not.toHaveBeenCalled();
  });

  it('rejects incorrect passwords and records the failed attempt', async () => {
    findUserByEmailMock.mockResolvedValueOnce(buildUserRecord());
    verifyMock.mockResolvedValueOnce(false);
    registerFailedAuthenticationAttemptMock.mockResolvedValueOnce({
      failedLoginAttempts: 4,
      lockedUntil: null,
    });

    await expect(
      service.authenticateCredentials({
        email: 'agent@courier.test',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(registerFailedAuthenticationAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'f5b65037-5a06-4545-8f0b-049b2b8ee8ee',
      }),
    );
  });

  it('converts the fifth failed attempt into a temporary lock', async () => {
    findUserByEmailMock.mockResolvedValueOnce(
      buildUserRecord({
        failedLoginAttempts: 4,
      }),
    );
    verifyMock.mockResolvedValueOnce(false);
    registerFailedAuthenticationAttemptMock.mockResolvedValueOnce({
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
    });

    await expect(
      service.authenticateCredentials({
        email: 'agent@courier.test',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(AccountTemporarilyLockedError);
  });

  it('rejects already locked accounts before password verification', async () => {
    findUserByEmailMock.mockResolvedValueOnce(
      buildUserRecord({
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    );

    await expect(
      service.authenticateCredentials({
        email: 'agent@courier.test',
        password: 'Correct Password',
      }),
    ).rejects.toBeInstanceOf(AccountTemporarilyLockedError);

    expect(verifyMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'invited users',
      user: buildUserRecord({
        status: 'INVITED',
      }),
    },
    {
      name: 'suspended users',
      user: buildUserRecord({
        status: 'SUSPENDED',
      }),
    },
    {
      name: 'disabled users',
      user: buildUserRecord({
        status: 'DISABLED',
      }),
    },
    {
      name: 'deleted users',
      user: buildUserRecord({
        deletedAt: new Date('2026-06-28T00:00:00.000Z'),
      }),
    },
    {
      name: 'users without a password hash',
      user: buildUserRecord({
        passwordHash: null,
      }),
    },
    {
      name: 'users without a verified email',
      user: buildUserRecord({
        emailVerifiedAt: null,
      }),
    },
  ])('rejects %s with generic invalid credentials', async ({ user }) => {
    findUserByEmailMock.mockResolvedValueOnce(user);
    verifyMock.mockResolvedValueOnce(false);

    await expect(
      service.authenticateCredentials({
        email: 'agent@courier.test',
        password: 'Correct Password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(registerFailedAuthenticationAttemptMock).not.toHaveBeenCalled();
  });

  it('resets counters, updates lastLoginAt flow, and returns safe organizations on success', async () => {
    findUserByEmailMock.mockResolvedValueOnce(buildUserRecord());
    verifyMock.mockResolvedValueOnce(true);
    registerSuccessfulAuthenticationMock.mockResolvedValueOnce({
      blocked: false,
      lockedUntil: null,
    });
    findAvailableOrganizationsForUserMock.mockResolvedValueOnce([
      buildMembership(),
      buildMembership({
        organizationId: '8ca2c7f4-9f8c-4599-9754-926cce395296',
        organizationSlug: 'courier-trial',
        organizationName: 'Courier Trial',
        organizationStatus: 'TRIAL',
        employeeId: '9a4fc709-9eb3-4e0d-8b2b-d0ea2fddf3ab',
        facilityIds: [],
        primaryFacilityId: undefined,
      }),
    ]);

    const result = await service.authenticateCredentials({
      email: 'agent@courier.test',
      password: 'Correct Password',
    });

    expect(registerSuccessfulAuthenticationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'f5b65037-5a06-4545-8f0b-049b2b8ee8ee',
      }),
    );
    expect(result).toEqual({
      userId: 'f5b65037-5a06-4545-8f0b-049b2b8ee8ee',
      email: 'agent@courier.test',
      organizations: [
        buildMembership(),
        buildMembership({
          organizationId: '8ca2c7f4-9f8c-4599-9754-926cce395296',
          organizationSlug: 'courier-trial',
          organizationName: 'Courier Trial',
          organizationStatus: 'TRIAL',
          employeeId: '9a4fc709-9eb3-4e0d-8b2b-d0ea2fddf3ab',
          facilityIds: [],
          primaryFacilityId: undefined,
        }),
      ],
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects a valid password if a concurrent lock was persisted before reset', async () => {
    findUserByEmailMock.mockResolvedValueOnce(buildUserRecord());
    verifyMock.mockResolvedValueOnce(true);
    registerSuccessfulAuthenticationMock.mockResolvedValueOnce({
      blocked: true,
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
    });

    await expect(
      service.authenticateCredentials({
        email: 'agent@courier.test',
        password: 'Correct Password',
      }),
    ).rejects.toBeInstanceOf(AccountTemporarilyLockedError);
  });

  it('returns organization context for an allowed organization', async () => {
    findOrganizationContextMock.mockResolvedValueOnce(
      buildOrganizationContext(),
    );

    await expect(
      service.selectOrganization({
        userId: '  f5b65037-5a06-4545-8f0b-049b2b8ee8ee  ',
        organizationId: '  1b5cdf33-6d50-4a91-ae66-6103bca9020f  ',
      }),
    ).resolves.toEqual(buildOrganizationContext());
  });

  it('rejects organization selection outside the authenticated scope', async () => {
    findOrganizationContextMock.mockResolvedValueOnce(null);

    await expect(
      service.selectOrganization({
        userId: 'f5b65037-5a06-4545-8f0b-049b2b8ee8ee',
        organizationId: 'foreign-organization',
      }),
    ).rejects.toBeInstanceOf(OrganizationAccessDeniedError);
  });
});
