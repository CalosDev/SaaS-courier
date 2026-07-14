import { getLocalBootstrapConfig } from './local-bootstrap.guard';

describe('getLocalBootstrapConfig', () => {
  it('rejects production even when explicitly authorized', () => {
    expect(() =>
      getLocalBootstrapConfig({
        NODE_ENV: 'production',
        ALLOW_LOCAL_BOOTSTRAP: 'true',
        LOCAL_BOOTSTRAP_EMAIL: 'admin@courier.local',
        LOCAL_BOOTSTRAP_PASSWORD: 'long-local-password',
      }),
    ).toThrow('disabled in production');
  });

  it('requires explicit authorization', () => {
    expect(() =>
      getLocalBootstrapConfig({
        NODE_ENV: 'development',
        LOCAL_BOOTSTRAP_EMAIL: 'admin@courier.local',
        LOCAL_BOOTSTRAP_PASSWORD: 'long-local-password',
      }),
    ).toThrow('ALLOW_LOCAL_BOOTSTRAP=true');
  });

  it('validates credentials and normalizes the email', () => {
    expect(
      getLocalBootstrapConfig({
        NODE_ENV: 'development',
        ALLOW_LOCAL_BOOTSTRAP: 'true',
        LOCAL_BOOTSTRAP_EMAIL: ' Admin@Courier.Local ',
        LOCAL_BOOTSTRAP_PASSWORD: 'long-local-password',
      }),
    ).toEqual({
      email: 'admin@courier.local',
      password: 'long-local-password',
    });
  });
});
