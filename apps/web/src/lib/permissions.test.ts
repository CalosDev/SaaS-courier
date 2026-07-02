import { describe, expect, it } from "vitest";

import {
  hasAllPermissions,
  hasEveryPermission,
  hasPermission,
} from "@/lib/permissions";

describe("permissions helpers", () => {
  it("checks a single permission code", () => {
    expect(hasPermission(["organizations.read"], "organizations.read")).toBe(true);
    expect(hasPermission(["organizations.read"], "roles.read")).toBe(false);
  });

  it("checks all required permission codes", () => {
    const permissionCodes = ["organizations.read", "roles.read", "customers.read"];

    expect(hasEveryPermission(permissionCodes, ["organizations.read", "roles.read"])).toBe(
      true,
    );
    expect(hasAllPermissions(permissionCodes, ["organizations.read", "customers.manage"])).toBe(
      false,
    );
  });
});
