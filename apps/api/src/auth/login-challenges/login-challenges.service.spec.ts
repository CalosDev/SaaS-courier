import { InvalidLoginChallengeError } from './login-challenge.errors';
import { LoginChallengeTokenService } from './login-challenge-token.service';
import { LoginChallengesRepository } from './login-challenges.repository';
import { LoginChallengesService } from './login-challenges.service';

describe('LoginChallengesService', () => {
  it('creates a hashed login challenge with five-minute expiry', async () => {
    const createLoginChallengeRecord = jest.fn().mockResolvedValue(undefined);
    const repository: LoginChallengesRepository = {
      createLoginChallengeRecord,
      consumeLoginChallengeRecord: jest.fn(),
    };
    const tokenService = new LoginChallengeTokenService();
    const service = new LoginChallengesService(repository, tokenService);

    const result = await service.createChallenge({
      userId: '6b142328-220f-4f89-9918-00e433e7f3f2',
    });

    expect(result.token).toMatch(/^lc1\.[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(createLoginChallengeRecord).toHaveBeenCalledTimes(1);
    const [firstCall] = createLoginChallengeRecord.mock.calls as [
      [{ tokenHash: string }],
    ];

    expect(firstCall[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a challenge that cannot be consumed', async () => {
    const repository: LoginChallengesRepository = {
      createLoginChallengeRecord: jest.fn(),
      consumeLoginChallengeRecord: jest.fn().mockResolvedValue({
        status: 'invalid',
      }),
    };
    const tokenService = new LoginChallengeTokenService();
    const service = new LoginChallengesService(repository, tokenService);
    const secret = tokenService.createSecret();

    await expect(
      service.consumeChallenge({
        challengeToken: secret.token,
      }),
    ).rejects.toBeInstanceOf(InvalidLoginChallengeError);
  });
});
