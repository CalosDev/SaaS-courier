import { InvalidLoginChallengeInputError } from './login-challenge.errors';
import { LoginChallengeTokenService } from './login-challenge-token.service';

describe('LoginChallengeTokenService', () => {
  it('creates lc1 tokens and lowercase SHA-256 hashes', () => {
    const service = new LoginChallengeTokenService();

    const firstSecret = service.createSecret();
    const secondSecret = service.createSecret();

    expect(firstSecret.token).toMatch(/^lc1\.[A-Za-z0-9_-]{43}$/);
    expect(firstSecret.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(secondSecret.token).not.toBe(firstSecret.token);
    expect(secondSecret.tokenHash).not.toBe(firstSecret.tokenHash);
  });

  it('hashes the same token deterministically', () => {
    const service = new LoginChallengeTokenService();
    const secret = service.createSecret();

    expect(service.hashToken(secret.token)).toBe(secret.tokenHash);
  });

  it('rejects malformed challenge tokens', () => {
    const service = new LoginChallengeTokenService();

    expect(() => service.assertValidTokenFormat('lc1.invalid')).toThrow(
      InvalidLoginChallengeInputError,
    );
  });
});
