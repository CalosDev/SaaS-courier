import { describe, expect, it } from "vitest";

import { resolveAuthenticatedRedirect } from "@/lib/auth/safe-redirect";

describe("resolveAuthenticatedRedirect", () => {
  it.each([null, undefined, "", "   "])(
    "uses the dashboard for an empty destination",
    (candidate) => {
      expect(resolveAuthenticatedRedirect(candidate)).toBe("/dashboard");
    },
  );

  it.each([
    "javascript:alert(1)",
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "/\\attacker.example/steal",
    "\\\\attacker.example\\steal",
    "/dashboard\nmalicious",
  ])("rejects an unsafe destination: %s", (candidate) => {
    expect(resolveAuthenticatedRedirect(candidate)).toBe("/dashboard");
  });

  it("preserves a same-origin path, query, and fragment", () => {
    expect(
      resolveAuthenticatedRedirect(" /packages/abc?tab=events#latest "),
    ).toBe("/packages/abc?tab=events#latest");
  });

  it("supports an explicit safe fallback", () => {
    expect(resolveAuthenticatedRedirect("https://attacker.example", "/")).toBe(
      "/",
    );
  });
});
