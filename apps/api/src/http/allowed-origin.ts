const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loadAllowedOrigins(): string[] {
  const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:3000';

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function isAllowedOrigin(
  origin: string,
  allowedOrigins: string[],
): boolean {
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  if (process.env.TENANT_SUBDOMAINS_ENABLED !== 'true') {
    return false;
  }

  try {
    const url = new URL(origin);
    const baseDomain = (process.env.APP_BASE_DOMAIN ?? '').toLowerCase();
    const suffix = `.${baseDomain}`;
    const slug = url.hostname.toLowerCase().endsWith(suffix)
      ? url.hostname.slice(0, -suffix.length).toLowerCase()
      : '';
    const protocolAllowed =
      process.env.NODE_ENV === 'production'
        ? url.protocol === 'https:' && (!url.port || url.port === '443')
        : url.protocol === 'https:' || url.protocol === 'http:';

    return (
      protocolAllowed &&
      TENANT_SLUG_PATTERN.test(slug) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
