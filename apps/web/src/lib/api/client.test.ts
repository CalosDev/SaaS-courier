import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/api-error";
import { onUnauthorized } from "@/lib/api/auth-events";
import { apiClient } from "@/lib/api/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("apiClient", () => {
  beforeEach(() => {
    apiClient.clearCsrf();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("retries one time when the API reports a renewable CSRF failure", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-1" }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "AUTH_CSRF_VALIDATION_FAILED",
              message: "CSRF validation failed.",
            },
          },
          403,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-2" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(apiClient.post<void>("/auth/logout", {})).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/backend/auth/csrf",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/backend/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.any(Headers),
      }),
    );
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "csrf-1",
    );
    expect((fetchMock.mock.calls[3]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "csrf-2",
    );
  });

  it("emits the unauthorized event for 401 responses", async () => {
    const handler = vi.fn();
    const cleanup = onUnauthorized(handler);
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required.",
          },
        },
        401,
      ),
    );

    await expect(apiClient.get("/auth/session")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
