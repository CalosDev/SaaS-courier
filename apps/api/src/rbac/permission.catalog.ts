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
    code: 'customs.read',
    name: 'Read customs cases',
    description: 'Allows reading customs cases within the current tenant.',
  },
  {
    code: 'customs.manage',
    name: 'Manage customs cases',
    description: 'Allows managing customs cases within the current tenant.',
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
  {
    code: 'rates.read',
    name: 'Read rates',
    description:
      'Allows reading courier services, rate cards and deterministic quotes within the current tenant.',
  },
  {
    code: 'rates.manage',
    name: 'Manage rates',
    description:
      'Allows managing courier services, draft rate cards, rate rules and activations within the current tenant.',
  },
  {
    code: 'billing.read',
    name: 'Read billing',
    description:
      'Allows reading invoices and billing data within the current tenant.',
  },
  {
    code: 'billing.manage',
    name: 'Manage billing',
    description:
      'Allows creating and managing invoices within the current tenant.',
  },
  {
    code: 'payments.manage',
    name: 'Manage payments',
    description:
      'Allows recording, applying, and voiding payments within the current tenant.',
  },
  {
    code: 'pickups.read',
    name: 'Read pickup requests',
    description:
      'Allows reading pickup requests and their status within the current tenant.',
  },
  {
    code: 'pickups.manage',
    name: 'Manage pickup requests',
    description:
      'Allows creating, updating and processing pickup requests within the current tenant.',
  },
  {
    code: 'tracking.read',
    name: 'Read package tracking',
    description:
      'Allows reading package tracking events within the current tenant.',
  },
  {
    code: 'tracking.manage',
    name: 'Manage package tracking',
    description:
      'Allows adding tracking events to packages within the current tenant.',
  },
  {
    code: 'dispatches.read',
    name: 'Read dispatches',
    description: 'Allows reading flight dispatches within the current tenant.',
  },
  {
    code: 'dispatches.manage',
    name: 'Manage dispatches',
    description: 'Allows managing flight dispatches within the current tenant.',
  },
  {
    code: 'customs_manifests.read',
    name: 'Read customs manifests',
    description: 'Allows reading customs manifests within the current tenant.',
  },
  {
    code: 'customs_manifests.manage',
    name: 'Manage customs manifests',
    description: 'Allows managing customs manifests within the current tenant.',
  },
  {
    code: 'shipments.read',
    name: 'Read shipments',
    description:
      'Allows reading house and master shipments within the current tenant.',
  },
  {
    code: 'shipments.manage',
    name: 'Manage shipments',
    description:
      'Allows managing house and master shipments within the current tenant.',
  },
  {
    code: 'holds.read',
    name: 'Read holds',
    description: 'Allows reading operational holds within the current tenant.',
  },
  {
    code: 'holds.manage',
    name: 'Manage holds',
    description: 'Allows managing operational holds within the current tenant.',
  },
  {
    code: 'corrections.read',
    name: 'Read corrections',
    description:
      'Allows reading correction requests within the current tenant.',
  },
  {
    code: 'corrections.manage',
    name: 'Manage corrections',
    description:
      'Allows managing correction requests within the current tenant.',
  },
  {
    code: 'transfers.read',
    name: 'Read transfers',
    description:
      'Allows reading internal facility transfers within the current tenant.',
  },
  {
    code: 'transfers.manage',
    name: 'Manage transfers',
    description:
      'Allows managing internal facility transfers within the current tenant.',
  },
  {
    code: 'deliveries.read',
    name: 'Read deliveries',
    description:
      'Allows reading final delivery orders and attempts within the current tenant.',
  },
  {
    code: 'deliveries.manage',
    name: 'Manage deliveries',
    description:
      'Allows creating, updating and dispatching final deliveries within the current tenant.',
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof permissionCatalog)[number]['code'];

export const PERMISSION_CATALOG = Object.freeze(
  permissionCatalog.map((definition) => Object.freeze({ ...definition })),
) as readonly (typeof permissionCatalog)[number][];

export const PERMISSION_CATALOG_CODES = new Set<PermissionCode>(
  PERMISSION_CATALOG.map((definition) => definition.code),
);
export const CUSTOMS_MANIFEST_PERMISSIONS = {
  VIEW: 'customs_manifests.read',
  MANAGE: 'customs_manifests.manage',
} as const;

export const CUSTOMS_PERMISSIONS = {
  READ: 'customs.read',
  MANAGE: 'customs.manage',
} as const;

export const CUSTOMER_PERMISSIONS = {
  VIEW: 'shipments.read',
  MANAGE: 'shipments.manage',
} as const;

export const SHIPMENT_PERMISSIONS = {
  VIEW: 'shipments.read',
  MANAGE: 'shipments.manage',
} as const;

export const TRANSFER_PERMISSIONS = {
  VIEW: 'transfers.read',
  MANAGE: 'transfers.manage',
} as const;

export const DELIVERY_PERMISSIONS = {
  READ: 'deliveries.read',
  MANAGE: 'deliveries.manage',
} as const;
