export type LocalBootstrapConfig = {
  email: string;
  password: string;
};

export function getLocalBootstrapConfig(
  environment: NodeJS.ProcessEnv,
): LocalBootstrapConfig {
  if (environment.APP_ENV !== 'local') {
    throw new Error('Local bootstrap requires APP_ENV=local');
  }

  if (environment.ALLOW_LOCAL_BOOTSTRAP !== 'true') {
    throw new Error(
      'Set ALLOW_LOCAL_BOOTSTRAP=true to authorize local bootstrap',
    );
  }

  assertLocalDatabase(environment.DATABASE_URL);

  const email = environment.LOCAL_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = environment.LOCAL_BOOTSTRAP_PASSWORD;

  if (!email || !email.includes('@')) {
    throw new Error('LOCAL_BOOTSTRAP_EMAIL must be a valid email address');
  }

  if (!password || password.length < 12) {
    throw new Error(
      'LOCAL_BOOTSTRAP_PASSWORD must contain at least 12 characters',
    );
  }

  return { email, password };
}

function assertLocalDatabase(value: string | undefined): void {
  if (!value) {
    throw new Error('DATABASE_URL is required for local bootstrap');
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'postgres',
    'host.docker.internal',
  ]);
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !localHosts.has(databaseUrl.hostname.toLowerCase())
  ) {
    throw new Error('Local bootstrap requires a local PostgreSQL database');
  }
}
