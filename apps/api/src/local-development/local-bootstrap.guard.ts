export type LocalBootstrapConfig = {
  email: string;
  password: string;
};

export function getLocalBootstrapConfig(
  environment: NodeJS.ProcessEnv,
): LocalBootstrapConfig {
  if (environment.NODE_ENV === 'production') {
    throw new Error('Local bootstrap is disabled in production');
  }

  if (environment.ALLOW_LOCAL_BOOTSTRAP !== 'true') {
    throw new Error(
      'Set ALLOW_LOCAL_BOOTSTRAP=true to authorize local bootstrap',
    );
  }

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
