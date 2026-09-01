import { describe, expect, it } from "vitest";

import {
  buildApiProxyHeaders,
  buildApiProxyUrl,
  resolveApiInternalUrl,
} from "@/lib/api/server-proxy";

describe("server API proxy", () => {
  it("resolves the internal API URL at request time", () => {
    expect(
      buildApiProxyUrl(["health", "live"], "?probe=1", {
        NODE_ENV: "production",
        API_INTERNAL_URL: "http://api:4000",
      }).toString(),
    ).toBe("http://api:4000/health/live?probe=1");
  });

  it("requires an explicit production target", () => {
    expect(() =>
      resolveApiInternalUrl({ NODE_ENV: "production" }),
    ).toThrow("API_INTERNAL_URL is required in production");
  });

  it.each([
    "ftp://api:4000",
    "http://user:password@api:4000",
    "http://api:4000?target=other",
  ])("rejects an unsafe internal target: %s", (candidate) => {
    expect(() =>
      resolveApiInternalUrl({
        NODE_ENV: "production",
        API_INTERNAL_URL: candidate,
      }),
    ).toThrow();
  });

  it("forwards the original tenant host and discards spoofed forwarding headers", () => {
    const request = new Request(
      "https://courier-one.example.test/backend/health/live",
      {
        headers: {
          host: "courier-one.example.test",
          "x-forwarded-for": "203.0.113.50",
          "x-forwarded-host": "attacker.example",
        },
      },
    );

    const headers = buildApiProxyHeaders(request);
    expect(headers.get("x-forwarded-host")).toBe("courier-one.example.test");
    expect(headers.get("x-forwarded-proto")).toBe("https");
    expect(headers.has("x-forwarded-for")).toBe(false);
    expect(headers.has("host")).toBe(false);
  });
});
