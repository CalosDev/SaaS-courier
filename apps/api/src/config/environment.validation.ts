const BOOLEAN_KEYS = [
  'COOKIE_SECURE',
  'S3_FORCE_PATH_STYLE',
  'SMTP_SECURE',
  'READINESS_REQUIRE_S3',
  'READINESS_REQUIRE_SMTP',
] as const;

const DEVELOPMENT_SECRET_MARKERS = [
  'courier_dev_password',
  'courier_minio_password',
  'replace_in_local_env',
];

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnvironment = text(environment.NODE_ENV) ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    fail('NODE_ENV must be development, test or production');
  }

  for (const key of BOOLEAN_KEYS) {
    const value = text(environment[key]);
    if (value && value !== 'true' && value !== 'false') {
      fail(`${key} must be true or false`);
    }
  }

  validateOptionalUrl(environment, 'S3_ENDPOINT');
  validateOptionalUrl(environment, 'NEXT_PUBLIC_API_URL');
  validateOptionalUrl(environment, 'API_INTERNAL_URL');
  validateCorsOrigins(environment);
  validateOptionalServiceGroups(environment);

  if (nodeEnvironment === 'production') {
    validateProductionEnvironment(environment);
  }

  return environment;
}

function validateProductionEnvironment(environment: Record<string, unknown>) {
  requireValue(environment, 'DATABASE_URL');
  requireValue(environment, 'CORS_ORIGINS');
  requireValue(environment, 'S3_ENDPOINT');
  requireValue(environment, 'S3_REGION');
  requireValue(environment, 'S3_BUCKET');
  requireValue(environment, 'S3_ACCESS_KEY');
  requireValue(environment, 'S3_SECRET_KEY');
  const encryption = requireValue(environment, 'S3_SERVER_SIDE_ENCRYPTION');
  requireValue(environment, 'SMTP_HOST');
  requireValue(environment, 'SMTP_FROM');
  requireValue(environment, 'CLAMAV_HOST');

  if (text(environment.APP_ENV) !== 'production') {
    fail('APP_ENV must be production when NODE_ENV=production');
  }
  if (text(environment.COOKIE_SECURE) !== 'true') {
    fail('COOKIE_SECURE must be true in production');
  }
  if (text(environment.READINESS_REQUIRE_S3) !== 'true') {
    fail('READINESS_REQUIRE_S3 must be true in production');
  }
  if (text(environment.READINESS_REQUIRE_SMTP) !== 'true') {
    fail('READINESS_REQUIRE_SMTP must be true in production');
  }
  if (text(environment.FILE_SCAN_MODE) !== 'clamav') {
    fail('FILE_SCAN_MODE must be clamav in production');
  }
  if (!['AES256', 'aws:kms'].includes(encryption)) {
    fail('S3_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms in production');
  }
  if (encryption === 'aws:kms') {
    requireValue(environment, 'S3_KMS_KEY_ID');
  }

  const databaseUrl = parseUrl(environment, 'DATABASE_URL');
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    fail('DATABASE_URL must use PostgreSQL');
  }
  const sslMode = databaseUrl.searchParams.get('sslmode');
  if (!['require', 'verify-ca', 'verify-full'].includes(sslMode ?? '')) {
    fail('DATABASE_URL must require PostgreSQL TLS in production');
  }

  const s3Endpoint = parseUrl(environment, 'S3_ENDPOINT');
  if (s3Endpoint.protocol !== 'https:') {
    fail('S3_ENDPOINT must use HTTPS in production');
  }

  for (const origin of corsOrigins(environment)) {
    const url = parseAbsoluteUrl(origin, 'CORS_ORIGINS');
    if (
      url.protocol !== 'https:' ||
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    ) {
      fail('CORS_ORIGINS must contain only production HTTPS origins');
    }
  }

  const sensitiveValues = [
    environment.DATABASE_URL,
    environment.S3_ACCESS_KEY,
    environment.S3_SECRET_KEY,
    environment.SMTP_PASSWORD,
  ]
    .map(text)
    .filter((value): value is string => Boolean(value));
  if (
    sensitiveValues.some((value) =>
      DEVELOPMENT_SECRET_MARKERS.some((marker) => value.includes(marker)),
    )
  ) {
    fail('Production configuration contains a known development credential');
  }
}

function validateOptionalServiceGroups(environment: Record<string, unknown>) {
  if (text(environment.S3_ENDPOINT)) {
    for (const key of [
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
    ]) {
      requireValue(environment, key);
    }
    const encryption = text(environment.S3_SERVER_SIDE_ENCRYPTION);
    if (encryption && !['AES256', 'aws:kms'].includes(encryption)) {
      fail('S3_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms');
    }
    if (encryption === 'aws:kms') {
      requireValue(environment, 'S3_KMS_KEY_ID');
    }
  }

  if (text(environment.SMTP_HOST)) {
    requireValue(environment, 'SMTP_PORT');
    requireValue(environment, 'SMTP_FROM');
  }

  const scanMode = text(environment.FILE_SCAN_MODE);
  if (scanMode && !['signature', 'clamav'].includes(scanMode)) {
    fail('FILE_SCAN_MODE must be signature or clamav');
  }
  if (scanMode === 'clamav') {
    requireValue(environment, 'CLAMAV_HOST');
  }
}

function validateCorsOrigins(environment: Record<string, unknown>) {
  for (const origin of corsOrigins(environment)) {
    if (origin === '*') fail('CORS_ORIGINS cannot contain a wildcard');
    parseAbsoluteUrl(origin, 'CORS_ORIGINS');
  }
}

function corsOrigins(environment: Record<string, unknown>): string[] {
  return (text(environment.CORS_ORIGINS) ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function validateOptionalUrl(
  environment: Record<string, unknown>,
  key: string,
) {
  if (text(environment[key])) parseUrl(environment, key);
}

function parseUrl(environment: Record<string, unknown>, key: string): URL {
  return parseAbsoluteUrl(requireValue(environment, key), key);
}

function parseAbsoluteUrl(value: string, key: string): URL {
  try {
    return new URL(value);
  } catch {
    fail(`${key} must contain valid absolute URLs`);
  }
}

function requireValue(
  environment: Record<string, unknown>,
  key: string,
): string {
  const value = text(environment[key]);
  if (!value) fail(`${key} is required`);
  return value;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function fail(message: string): never {
  throw new Error(`Invalid environment configuration: ${message}`);
}
