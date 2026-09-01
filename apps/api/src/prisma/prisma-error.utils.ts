import type { Prisma } from '../generated/prisma/client';

type DriverAdapterCause = {
  constraint?: {
    fields?: unknown;
  };
  originalMessage?: unknown;
};

export function matchesPrismaUniqueConstraint(
  error: unknown,
  targetName: string,
  ...candidateFragments: string[]
): boolean {
  if (!isKnownRequestError(error) || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;
  const targetText = Array.isArray(target)
    ? target.join(',')
    : typeof target === 'string'
      ? target
      : '';
  const driverAdapterCause = readDriverAdapterCause(error.meta);
  const constraintFields = Array.isArray(driverAdapterCause?.constraint?.fields)
    ? driverAdapterCause.constraint.fields.join(',')
    : '';
  const originalMessage =
    typeof driverAdapterCause?.originalMessage === 'string'
      ? driverAdapterCause.originalMessage
      : '';
  const haystack = [targetText, constraintFields, originalMessage]
    .filter((value) => value.length > 0)
    .join(',');

  return (
    haystack.includes(targetName) ||
    candidateFragments.some((fragment) => haystack.includes(fragment))
  );
}

function isKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Error && 'code' in error && 'meta' in error;
}

function readDriverAdapterCause(
  meta: Prisma.PrismaClientKnownRequestError['meta'],
): DriverAdapterCause | undefined {
  if (!meta || typeof meta !== 'object' || !('driverAdapterError' in meta)) {
    return undefined;
  }

  const driverAdapterError = meta.driverAdapterError;

  if (
    !driverAdapterError ||
    typeof driverAdapterError !== 'object' ||
    !('cause' in driverAdapterError)
  ) {
    return undefined;
  }

  const cause = driverAdapterError.cause;

  return cause && typeof cause === 'object' ? cause : undefined;
}
