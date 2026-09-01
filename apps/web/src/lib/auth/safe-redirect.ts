const DEFAULT_AUTHENTICATED_PATH = "/dashboard";
const SAME_ORIGIN_BASE = "https://courier.invalid";

export function resolveAuthenticatedRedirect(
  candidate: string | null | undefined,
  fallback = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (!candidate) {
    return fallback;
  }

  const normalized = candidate.trim();
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    return fallback;
  }

  try {
    const url = new URL(normalized, SAME_ORIGIN_BASE);
    if (url.origin !== SAME_ORIGIN_BASE) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
