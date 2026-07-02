import { describe, expect, it, vi } from "vitest";

import { readActivationTokenFromHash } from "@/app/activate/page";

describe("readActivationTokenFromHash", () => {
  it("reads the activation token from the fragment and clears the hash", () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/activate#token=secret-token",
    );

    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    expect(readActivationTokenFromHash()).toBe("secret-token");
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/activate");
    expect(window.location.hash).toBe("");
  });
});
