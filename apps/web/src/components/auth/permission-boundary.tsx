import { hasEveryPermission, type PermissionCode } from "@/lib/permissions";
import { useAuth } from "@/lib/auth/auth-provider";

export function PermissionBoundary({
  requiredPermissions,
  children,
  fallback = null,
}: {
  requiredPermissions: readonly PermissionCode[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { state } = useAuth();

  if (state.status !== "authenticated") {
    return fallback;
  }

  if (!hasEveryPermission(state.permissionCodes, requiredPermissions)) {
    return fallback;
  }

  return children;
}
