"use client";

import type { ApiErrorEnvelope } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/api-error";
import {
  emitForbiddenEvent,
  emitUnauthorizedEvent,
} from "@/lib/api/auth-events";
import { csrfManager } from "@/lib/api/csrf-manager";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  retryOnCsrf?: boolean;
};

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const API_BASE_PATH =
  process.env.NEXT_PUBLIC_API_BASE_PATH?.trim() || "/backend";

async function ensureCsrfToken(): Promise<string> {
  const cachedToken = csrfManager.getToken();

  if (cachedToken) {
    return cachedToken;
  }

  const response = await fetch(`${API_BASE_PATH}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: "AUTH_CSRF_TOKEN_UNAVAILABLE",
      message: "No fue posible obtener el token CSRF.",
    });
  }

  const body = (await response.json()) as { csrfToken?: string };

  if (!body.csrfToken) {
    throw new ApiError({
      status: 500,
      code: "AUTH_CSRF_TOKEN_MISSING",
      message: "La respuesta CSRF no incluyó token.",
    });
  }

  csrfManager.setToken(body.csrfToken);
  return body.csrfToken;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

function normalizeApiError(response: Response, payload: unknown): ApiError {
  const envelope = payload as ApiErrorEnvelope;
  const code = envelope?.error?.code || `HTTP_${response.status}`;
  const message = envelope?.error?.message || "La solicitud falló.";

  return new ApiError({
    status: response.status,
    code,
    message,
    payload,
  });
}

async function requestInternal<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;

  if (options.body instanceof FormData || typeof options.body === "string") {
    body = options.body;
  } else if (options.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  if (UNSAFE_METHODS.has(method)) {
    headers.set("X-CSRF-Token", await ensureCsrfToken());
  }

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...options,
    method,
    body,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (response.ok) {
    return parseResponse<T>(response);
  }

  const payload = await parseResponse<unknown>(response);
  const error = normalizeApiError(response, payload);

  if (
    error.status === 403 &&
    error.code === "AUTH_CSRF_VALIDATION_FAILED" &&
    options.retryOnCsrf !== false
  ) {
    csrfManager.clear();
    return requestInternal<T>(path, {
      ...options,
      retryOnCsrf: false,
    });
  }

  if (error.status === 401) {
    emitUnauthorizedEvent();
  } else if (error.status === 403) {
    emitForbiddenEvent();
  }

  throw error;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return requestInternal<T>(path, { method: "GET" });
  },
  post<T>(path: string, body?: Record<string, unknown> | null): Promise<T> {
    return requestInternal<T>(path, { method: "POST", body });
  },
  put<T>(path: string, body?: Record<string, unknown> | null): Promise<T> {
    return requestInternal<T>(path, { method: "PUT", body });
  },
  patch<T>(path: string, body?: Record<string, unknown> | null): Promise<T> {
    return requestInternal<T>(path, { method: "PATCH", body });
  },
  delete<T>(path: string): Promise<T> {
    return requestInternal<T>(path, { method: "DELETE" });
  },
  clearCsrf(): void {
    csrfManager.clear();
  },
};
