import { CsrfTokenService } from './csrf-token.service';

describe('CsrfTokenService', () => {
  it('creates cf1 tokens and validates matching values', () => {
    const service = new CsrfTokenService();
    const token = service.createToken();

    expect(token).toMatch(/^cf1\.[A-Za-z0-9_-]{43}$/);
    expect(service.tokensMatch(token, token)).toBe(true);
  });

  it('rejects missing or mismatched tokens', () => {
    const service = new CsrfTokenService();
    const firstToken = service.createToken();
    const secondToken = service.createToken();

    expect(service.tokensMatch(firstToken, secondToken)).toBe(false);
    expect(service.tokensMatch(firstToken, 'invalid')).toBe(false);
  });
});
