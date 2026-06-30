import {
  InvalidSessionInputError,
  InvalidSessionTokenError,
  SessionCreationDeniedError,
} from './session.errors';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';
import type {
  CreateSessionRecordInput,
  RevokeAllUserSessionsInput,
  SessionContext,
  SessionTokenSecret,
  SessionValidationRecord,
} from './session.types';

function buildSessionContext(
  overrides: Partial<SessionContext> = {},
): SessionContext {
  return {
    sessionId: '15bc9db7-a94f-4b44-b0cf-f91a7bd36531',
    expiresAt: new Date('2026-06-29T12:00:00.000Z'),
    userId: '05b1a8bf-5f6b-4c1a-a3de-60060206e513',
    email: 'agent@courier.test',
    organizationId: '7d59c8f2-34f1-41fd-9868-a7b80ff4db89',
    organizationSlug: 'courier-central',
    organizationName: 'Courier Central',
    employeeId: '3f81ba20-bafb-4680-a8d6-af2adf6d5060',
    employeeCode: 'EMP-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    facilityIds: ['fac-1', 'fac-2'],
    primaryFacilityId: 'fac-1',
    ...overrides,
  };
}

function buildValidationRecord(
  overrides: Partial<SessionValidationRecord> = {},
): SessionValidationRecord {
  return {
    status: 'valid',
    session: buildSessionContext(),
    ...overrides,
  };
}

describe('SessionsService', () => {
  const findCreateContextMock = jest.fn<
    Promise<SessionContext | null>,
    [string, string]
  >();
  const createSessionRecordMock = jest.fn<
    Promise<SessionContext>,
    [CreateSessionRecordInput]
  >();
  const validateSessionRecordMock = jest.fn();
  const rotateSessionRecordMock = jest.fn();
  const revokeSessionRecordMock = jest.fn();
  const revokeAllUserSessionsRecordMock = jest.fn();

  const repository: jest.Mocked<SessionsRepository> = {
    findSessionCreationContext: findCreateContextMock,
    createSessionRecord: createSessionRecordMock,
    validateSessionRecord: validateSessionRecordMock,
    rotateSessionRecord: rotateSessionRecordMock,
    revokeSessionRecord: revokeSessionRecordMock,
    revokeAllUserSessionsRecord: revokeAllUserSessionsRecordMock,
  };

  const createSecretMock = jest.fn<SessionTokenSecret, []>();
  const assertValidTokenFormatMock = jest.fn<void, [string]>();
  const hashTokenMock = jest.fn<string, [string]>();

  const sessionTokenService = {
    createSecret: createSecretMock,
    assertValidTokenFormat: assertValidTokenFormatMock,
    hashToken: hashTokenMock,
  };

  const service = new SessionsService(repository, sessionTokenService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createSession stores only the token hash and returns the raw token once', async () => {
    findCreateContextMock.mockResolvedValueOnce(buildSessionContext());
    createSecretMock.mockReturnValueOnce({
      token: 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      tokenHash:
        '1111111111111111111111111111111111111111111111111111111111111111',
    });
    createSessionRecordMock.mockResolvedValueOnce(buildSessionContext());

    const result = await service.createSession({
      userId: '05b1a8bf-5f6b-4c1a-a3de-60060206e513',
      organizationId: '7d59c8f2-34f1-41fd-9868-a7b80ff4db89',
      ipAddress: '127.0.0.1',
      userAgent: 'Jest',
    });

    const [createSessionRecordInput] =
      createSessionRecordMock.mock.calls[0] ?? [];

    expect(createSessionRecordInput?.tokenHash).toBe(
      '1111111111111111111111111111111111111111111111111111111111111111',
    );
    expect(createSessionRecordInput).toBeDefined();
    expect('token' in (createSessionRecordInput ?? {})).toBe(false);
    expect(result.sessionToken).toBe(
      'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
    );
    expect(result.session).toEqual(buildSessionContext());
  });

  it('rejects createSession when the organization context is not valid', async () => {
    findCreateContextMock.mockResolvedValueOnce(null);

    await expect(
      service.createSession({
        userId: '05b1a8bf-5f6b-4c1a-a3de-60060206e513',
        organizationId: '7d59c8f2-34f1-41fd-9868-a7b80ff4db89',
      }),
    ).rejects.toBeInstanceOf(SessionCreationDeniedError);
  });

  it('validateSession uses the hashed token and does not expose internal fields', async () => {
    assertValidTokenFormatMock.mockImplementationOnce(() => undefined);
    hashTokenMock.mockReturnValueOnce(
      '2222222222222222222222222222222222222222222222222222222222222222',
    );
    validateSessionRecordMock.mockResolvedValueOnce(buildValidationRecord());

    const result = await service.validateSession({
      sessionToken: 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
    });

    expect(hashTokenMock).toHaveBeenCalledWith(
      'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
    );
    expect(validateSessionRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash:
          '2222222222222222222222222222222222222222222222222222222222222222',
      }),
    );
    expect(result).toEqual(buildSessionContext());
    expect(result).not.toHaveProperty('tokenHash');
  });

  it('rotateSession generates a different token and preserves the absolute expiration', async () => {
    createSecretMock.mockReturnValueOnce({
      token: 'cs1.ROTATEDTOKENVALUEabcdefghijklmnopqrstuvwxyz1',
      tokenHash:
        '3333333333333333333333333333333333333333333333333333333333333333',
    });
    assertValidTokenFormatMock.mockImplementationOnce(() => undefined);
    hashTokenMock.mockReturnValueOnce(
      '4444444444444444444444444444444444444444444444444444444444444444',
    );
    rotateSessionRecordMock.mockResolvedValueOnce({
      status: 'rotated',
      session: buildSessionContext({
        sessionId: 'f870cbd8-c29f-4a88-8caf-f5272aeaf3b1',
      }),
    });

    const result = await service.rotateSession({
      sessionToken: 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      ipAddress: '127.0.0.1',
      userAgent: 'Jest',
    });

    expect(result.sessionToken).toBe(
      'cs1.ROTATEDTOKENVALUEabcdefghijklmnopqrstuvwxyz1',
    );
    expect(result.session.expiresAt).toEqual(
      new Date('2026-06-29T12:00:00.000Z'),
    );
  });

  it('revokeSession is idempotent', async () => {
    assertValidTokenFormatMock.mockImplementation(() => undefined);
    hashTokenMock.mockReturnValue(
      '5555555555555555555555555555555555555555555555555555555555555555',
    );
    revokeSessionRecordMock.mockResolvedValue(undefined);

    await expect(
      service.revokeSession({
        sessionToken: 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      }),
    ).resolves.toBeUndefined();

    await expect(
      service.revokeSession({
        sessionToken: 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects invalid session tokens with a generic error', async () => {
    assertValidTokenFormatMock.mockImplementationOnce(() => undefined);
    hashTokenMock.mockReturnValueOnce(
      '6666666666666666666666666666666666666666666666666666666666666666',
    );
    validateSessionRecordMock.mockResolvedValueOnce({
      status: 'invalid',
    });

    await expect(
      service.validateSession({
        sessionToken: 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      }),
    ).rejects.toBeInstanceOf(InvalidSessionTokenError);
  });

  it('revokeAllUserSessions only accepts administrative reasons', async () => {
    revokeAllUserSessionsRecordMock.mockResolvedValueOnce(2);

    await expect(
      service.revokeAllUserSessions({
        userId: '05b1a8bf-5f6b-4c1a-a3de-60060206e513',
        reason: 'ADMIN_REVOKED',
      }),
    ).resolves.toBe(2);

    await expect(
      service.revokeAllUserSessions({
        userId: '05b1a8bf-5f6b-4c1a-a3de-60060206e513',
        reason: 'LOGOUT',
      } as unknown as RevokeAllUserSessionsInput),
    ).rejects.toBeInstanceOf(InvalidSessionInputError);
  });
});
