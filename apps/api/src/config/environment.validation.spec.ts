import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('allows optional integrations in local development', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'development',
        APP_ENV: 'local',
        CORS_ORIGINS: 'http://localhost:3000',
        COOKIE_SECURE: 'false',
        FILE_SCAN_MODE: 'signature',
      }),
    ).toMatchObject({ APP_ENV: 'local' });
  });

  it('rejects production without secure cookies', () => {
    expect(() =>
      validateEnvironment(productionEnvironment({ COOKIE_SECURE: 'false' })),
    ).toThrow('COOKIE_SECURE must be true');
  });

  it('rejects local CORS origins in production', () => {
    expect(() =>
      validateEnvironment(
        productionEnvironment({ CORS_ORIGINS: 'http://localhost:3000' }),
      ),
    ).toThrow('production HTTPS origins');
  });

  it('rejects known development credentials in production', () => {
    expect(() =>
      validateEnvironment(
        productionEnvironment({ S3_SECRET_KEY: 'courier_minio_password' }),
      ),
    ).toThrow('known development credential');
  });

  it('accepts a complete production configuration', () => {
    expect(validateEnvironment(productionEnvironment())).toBeDefined();
  });
});

function productionEnvironment(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DATABASE_URL:
      'postgresql://courier:unique-password@database.example/courier?sslmode=require',
    CORS_ORIGINS: 'https://courier.example',
    COOKIE_SECURE: 'true',
    S3_ENDPOINT: 'https://objects.example',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'courier-documents',
    S3_ACCESS_KEY: 'unique-access-key',
    S3_SECRET_KEY: 'unique-secret-key',
    S3_SERVER_SIDE_ENCRYPTION: 'AES256',
    SMTP_HOST: 'smtp.example',
    SMTP_PORT: '587',
    SMTP_FROM: 'no-reply@example.com',
    READINESS_REQUIRE_S3: 'true',
    READINESS_REQUIRE_SMTP: 'true',
    FILE_SCAN_MODE: 'clamav',
    CLAMAV_HOST: 'clamav.internal',
    ...overrides,
  };
}
