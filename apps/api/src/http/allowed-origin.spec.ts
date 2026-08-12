import { isAllowedOrigin } from './allowed-origin';

describe('isAllowedOrigin', () => {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    APP_BASE_DOMAIN: process.env.APP_BASE_DOMAIN,
    TENANT_SUBDOMAINS_ENABLED: process.env.TENANT_SUBDOMAINS_ENABLED,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('accepts exact configured origins', () => {
    expect(
      isAllowedOrigin('http://localhost:3000', ['http://localhost:3000']),
    ).toBe(true);
  });

  it('accepts only immediate tenant subdomains when enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_BASE_DOMAIN = 'platform.example';
    process.env.TENANT_SUBDOMAINS_ENABLED = 'true';

    expect(isAllowedOrigin('https://courier-a.platform.example', [])).toBe(
      true,
    );
    expect(
      isAllowedOrigin('https://nested.courier-a.platform.example', []),
    ).toBe(false);
    expect(isAllowedOrigin('https://platform.example', [])).toBe(false);
    expect(isAllowedOrigin('https://courier-a.other.example', [])).toBe(false);
  });

  it('rejects insecure tenant origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_BASE_DOMAIN = 'platform.example';
    process.env.TENANT_SUBDOMAINS_ENABLED = 'true';

    expect(isAllowedOrigin('http://courier-a.platform.example', [])).toBe(
      false,
    );
    expect(isAllowedOrigin('https://courier-a.platform.example:444', [])).toBe(
      false,
    );
  });
});
