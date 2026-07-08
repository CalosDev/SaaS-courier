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
  {
    code: 'audit.read',
    name: 'Read audit logs',
    description: 'Allows reading audit logs within the current tenant.',
  },
  {
    code: 'prealerts.read',
    name: 'Read prealerts',
    description: 'Allows reading prealerts within the current tenant.',
  },
  {
    code: 'prealerts.manage',
    name: 'Manage prealerts',
    description:
      'Allows creating, updating and cancelling prealerts within the current tenant.',
  },
  {
    code: 'packages.read',
    name: 'Read packages',
    description:
      'Allows reading package registration data within the current tenant.',
  },
  {
    code: 'packages.manage',
    name: 'Manage packages',
    description:
      'Allows creating, updating and cancelling package registrations within the current tenant.',
  },
  {
    code: 'packages.receive',
    name: 'Receive packages',
    description:
      'Allows recording physical package reception within assigned facilities.',
  },
  {
    code: 'package_documents.read',
    name: 'Read package documents',
    description: 'Allows reading package documents within the current tenant.',
  },
  {
    code: 'package_documents.manage',
    name: 'Manage package documents',
    description:
      'Allows creating, completing and deleting package documents within the current tenant.',
  },
  {
    code: 'inventory.read',
    name: 'Read inventory',
    description:
      'Allows reading warehouse locations, current package positions and inventory movements within the current tenant.',
  },
  {
    code: 'inventory.manage',
    name: 'Manage inventory',
    description:
      'Allows managing warehouse locations and moving received packages within inventory for the current tenant.',
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof permissionCatalog)[number]['code'];

export const PERMISSION_CATALOG = Object.freeze(
  permissionCatalog.map((definition) => Object.freeze({ ...definition })),
) as readonly (typeof permissionCatalog)[number][];

export const PERMISSION_CATALOG_CODES = new Set<PermissionCode>(
  PERMISSION_CATALOG.map((definition) => definition.code),
);
