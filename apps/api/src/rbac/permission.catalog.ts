import type { PermissionDefinition } from './rbac.types';

const permissionCatalog = [
  {
    code: 'organizations.read',
    name: 'Read organizations',
    description: 'Allows reading organization data within the current tenant.',
  },
  {
    code: 'organizations.manage',
    name: 'Manage organizations',
    description:
      'Allows managing organization settings within the current tenant.',
  },
  {
    code: 'facilities.read',
    name: 'Read facilities',
    description: 'Allows reading facility data within the current tenant.',
  },
  {
    code: 'facilities.manage',
    name: 'Manage facilities',
    description: 'Allows managing facilities within the current tenant.',
  },
  {
    code: 'employees.read',
    name: 'Read employees',
    description: 'Allows reading employee data within the current tenant.',
  },
  {
    code: 'employees.manage',
    name: 'Manage employees',
    description: 'Allows managing employee records within the current tenant.',
  },
  {
    code: 'roles.read',
    name: 'Read roles',
    description: 'Allows reading RBAC roles within the current tenant.',
  },
  {
    code: 'roles.manage',
    name: 'Manage roles',
    description: 'Allows managing RBAC roles within the current tenant.',
  },
  {
    code: 'permissions.read',
    name: 'Read permissions',
    description: 'Allows reading the permission catalog.',
  },
  {
    code: 'customers.read',
    name: 'Read customers',
    description: 'Allows reading customer data within the current tenant.',
  },
  {
    code: 'customers.manage',
    name: 'Manage customers',
    description: 'Allows managing customer records within the current tenant.',
  },
  {
    code: 'customers.customs.read',
    name: 'Read customer customs profiles',
    description:
      'Allows reading customer customs identity and RUA verification data within the current tenant.',
  },
  {
    code: 'customers.customs.manage',
    name: 'Manage customer customs profiles',
    description:
      'Allows managing customer customs identity and RUA verification data within the current tenant.',
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof permissionCatalog)[number]['code'];

export const PERMISSION_CATALOG = Object.freeze(
  permissionCatalog.map((definition) => Object.freeze({ ...definition })),
) as readonly (typeof permissionCatalog)[number][];

export const PERMISSION_CATALOG_CODES = new Set<PermissionCode>(
  PERMISSION_CATALOG.map((definition) => definition.code),
);
