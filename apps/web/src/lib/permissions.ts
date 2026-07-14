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
  "customs.read",
  "customs.manage",
  "customers.customs.read",
  "customers.customs.manage",
  "audit.read",
  "prealerts.read",
  "prealerts.manage",
  "packages.read",
  "packages.manage",
  "packages.receive",
  "package_documents.read",
  "package_documents.manage",
  "inventory.read",
  "inventory.manage",
  "rates.read",
  "rates.manage",
  "billing.read",
  "billing.manage",
  "payments.manage",
  "pickups.read",
  "pickups.manage",
  "tracking.read",
  "tracking.manage",
  "dispatches.read",
  "dispatches.manage",
  "customs_manifests.read",
  "customs_manifests.manage",
  "shipments.read",
  "shipments.manage",
  "holds.read",
  "holds.manage",
  "corrections.read",
  "corrections.manage",
  "transfers.read",
  "transfers.manage",
  "deliveries.read",
  "deliveries.manage",
  "reports.read",
  "reports.export",
  "notifications.read",
  "notifications.manage",
  "carriers.read",
  "carriers.manage",
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
