import { ActivationTokenService } from './activation-token.service';

describe('ActivationTokenService', () => {
  const activationTokenService = new ActivationTokenService();

  it('generates a raw activation secret and its SHA-256 hash', () => {
    const secret = activationTokenService.createSecret();

    expect(secret.token).toBeTruthy();
    expect(secret.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(secret.tokenHash).toBe(
      activationTokenService.hashToken(secret.token),
    );
  });

  it('generates different secrets on consecutive calls', () => {
    const firstSecret = activationTokenService.createSecret();
    const secondSecret = activationTokenService.createSecret();

    expect(firstSecret.token).not.toBe(secondSecret.token);
    expect(firstSecret.tokenHash).not.toBe(secondSecret.tokenHash);
  });

  it('produces URL-safe base64url activation secrets', () => {
    const secret = activationTokenService.createSecret();

    expect(secret.token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
