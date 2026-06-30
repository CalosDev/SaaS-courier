import { SetMetadata } from '@nestjs/common';

import type { PermissionCode } from '../permission.catalog';
import { REQUIRED_PERMISSIONS_KEY } from './authorization.constants';

type PermissionCodeList = [PermissionCode, ...PermissionCode[]];

function normalizePermissionCodes(
  permissions: PermissionCodeList,
): readonly PermissionCode[] {
  const uniquePermissions = new Set<PermissionCode>();

  for (const permission of permissions) {
    uniquePermissions.add(permission);
  }

  return [...uniquePermissions];
}

export const RequirePermissions = (
  ...permissions: PermissionCodeList
): MethodDecorator & ClassDecorator => {
  if (permissions.length === 0) {
    throw new Error('RequirePermissions requires at least one permission.');
  }

  return SetMetadata(
    REQUIRED_PERMISSIONS_KEY,
    normalizePermissionCodes(permissions),
  );
};
