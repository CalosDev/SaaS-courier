const UNAUTHORIZED_EVENT = "courier:auth-unauthorized";
const FORBIDDEN_EVENT = "courier:auth-forbidden";

export function emitUnauthorizedEvent(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

export function emitForbiddenEvent(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FORBIDDEN_EVENT));
  }
}

export function onUnauthorized(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

export function onForbidden(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(FORBIDDEN_EVENT, handler);
  return () => window.removeEventListener(FORBIDDEN_EVENT, handler);
}
