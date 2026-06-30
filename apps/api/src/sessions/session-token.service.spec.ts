import { InvalidSessionInputError } from './session.errors';
import { SessionTokenService } from './session-token.service';

describe('SessionTokenService', () => {
  const service = new SessionTokenService();

  it('generates opaque tokens with the approved format', () => {
    const secret = service.createSecret();

    expect(secret.token).toMatch(/^cs1\.[A-Za-z0-9_-]{43}$/);
    expect(secret.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates distinct tokens and hashes', () => {
    const first = service.createSecret();
    const second = service.createSecret();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it('creates deterministic SHA-256 hashes with 64 lowercase hex characters', () => {
    const token = 'cs1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12';
    const firstHash = service.hashToken(token);
    const secondHash = service.hashToken(token);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects invalid token formats', () => {
    expect(() => service.assertValidTokenFormat('')).toThrow(
      InvalidSessionInputError,
    );
    expect(() => service.assertValidTokenFormat('not-a-session-token')).toThrow(
      InvalidSessionInputError,
    );
    expect(() => service.assertValidTokenFormat('cs1.invalid+base64')).toThrow(
      InvalidSessionInputError,
    );
  });
});
