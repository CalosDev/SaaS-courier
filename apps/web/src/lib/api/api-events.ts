export const API_ERROR_EVENT = "courier:api-error";

export function emitApiErrorEvent(message: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(API_ERROR_EVENT, { detail: { message } })
    );
  }
}

export function onApiError(handler: (message: string) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<{ message: string }>;
    handler(customEvent.detail.message);
  };

  window.addEventListener(API_ERROR_EVENT, listener);
  return () => window.removeEventListener(API_ERROR_EVENT, listener);
}
