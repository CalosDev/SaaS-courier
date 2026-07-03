const PROHIBITED_KEY_PARTS = [
  'password',
  'token',
  'csrf',
  'cookie',
  'authorization',
  'secret',
  'apikey',
  'certificate',
  'pin',
  'rawdata',
  'normalizeddata',
];

export function sanitizeAuditData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditData(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (PROHIBITED_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
      continue;
    }

    if (key === 'documentNumber') {
      sanitized.documentNumberMasked = maskIdentifier(item);
      continue;
    }

    sanitized[key] = sanitizeAuditData(item);
  }

  return sanitized;
}

export function containsProhibitedAuditData(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsProhibitedAuditData(item));
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return Object.entries(value).some(([key, item]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return (
      PROHIBITED_KEY_PARTS.some((part) => normalizedKey.includes(part)) ||
      containsProhibitedAuditData(item)
    );
  });
}

function maskIdentifier(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '***';
  }

  const visible = value.slice(-2);
  return `${'*'.repeat(Math.max(3, value.length - visible.length))}${visible}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
