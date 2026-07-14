import { getLocalBootstrapConfig } from './local-bootstrap.guard';

describe('getLocalBootstrapConfig', () => {
  const localDatabaseUrl =
    'postgresql://courier:password@localhost:5432/courier_saas';

  it('rejects any environment not explicitly marked local', () => {
    expect(() =>
      getLocalBootstrapConfig({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        ALLOW_LOCAL_BOOTSTRAP: 'true',
        LOCAL_BOOTSTRAP_EMAIL: 'admin@courier.local',
        LOCAL_BOOTSTRAP_PASSWORD: 'long-local-password',
        DATABASE_URL: localDatabaseUrl,
      }),
    ).toThrow('APP_ENV=local');
  });

  it('requires explicit authorization', () => {
    expect(() =>
      getLocalBootstrapConfig({
        NODE_ENV: 'development',
        APP_ENV: 'local',
        LOCAL_BOOTSTRAP_EMAIL: 'admin@courier.local',
        LOCAL_BOOTSTRAP_PASSWORD: 'long-local-password',
        DATABASE_URL: localDatabaseUrl,
      }),
    ).toThrow('ALLOW_LOCAL_BOOTSTRAP=true');
  });

  it('validates credentials and normalizes the email', () => {
    expect(
      getLocalBootstrapConfig({
        NODE_ENV: 'development',
        APP_ENV: 'local',
        ALLOW_LOCAL_BOOTSTRAP: 'true',
        LOCAL_BOOTSTRAP_EMAIL: ' Admin@Courier.Local ',
        LOCAL_BOOTSTRAP_PASSWORD: 'long-local-password',
        DATABASE_URL: localDatabaseUrl,
      }),
    ).toEqual({
      email: 'admin@courier.local',
      password: 'long-local-password',
    });
  });

  it('rejects a remote database even in local mode', () => {
    expect(() =>
      getLocalBootstrapConfig({
        NODE_ENV: 'development',
        APP_ENV: 'local',
        ALLOW_LOCAL_BOOTSTRAP: 'true',
        LOCAL_BOOTSTRAP_EMAIL: 'admin@courier.local',
        LOCAL_BOOTSTRAP_PASSWORD: 'long-local-password',
        DATABASE_URL:
          'postgresql://courier:password@database.example:5432/courier_saas',
      }),
    ).toThrow('local PostgreSQL database');
  });
});
