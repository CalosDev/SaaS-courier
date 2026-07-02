export const PERMISSION_CODES = [
  "organizations.read",
  "organizations.manage",
  "facilities.read",
  "facilities.manage",
  "employees.read",
  "employees.manage",
  "roles.read",
  "roles.manage",
  "permissions.read",
  "customers.read",
  "customers.manage",
  "customers.customs.read",
  "customers.customs.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export function hasPermission(
  permissionCodes: readonly string[],
  permissionCode: PermissionCode,
): boolean {
  return permissionCodes.includes(permissionCode);
}

export function hasEveryPermission(
  permissionCodes: readonly string[],
  requiredPermissions: readonly PermissionCode[],
): boolean {
  return requiredPermissions.every((permission) =>
    hasPermission(permissionCodes, permission),
  );
}

export const hasAllPermissions = hasEveryPermission;
