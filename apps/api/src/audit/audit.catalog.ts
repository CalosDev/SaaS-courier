export const AUDIT_ACTIONS = [
  'organization.updated',
  'organization.settings.updated',
  'organization.onboarding.completed',
  'facility.created',
  'facility.updated',
  'employee.invited',
  'employee.updated',
  'employee.facilities.replaced',
  'employee.roles.replaced',
  'employee.sessions.revoked',
  'role.created',
  'role.updated',
  'role.permissions.replaced',
  'customer.created',
  'customer.updated',
  'customer.address.created',
  'customer.address.updated',
  'customer.customs_profile.updated',
  'customer.customs_verification.updated',
  'customer_import.created',
  'customer_import.validated',
  'customer_import.committed',
  'customer_import.cancelled',
  'prealert.created',
  'prealert.updated',
  'prealert.cancelled',
] as const;

export type AuditActionCode = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  'ORGANIZATION',
  'ORGANIZATION_SETTINGS',
  'FACILITY',
  'EMPLOYEE',
  'ROLE',
  'CUSTOMER',
  'CUSTOMER_ADDRESS',
  'CUSTOMER_CUSTOMS_PROFILE',
  'CUSTOMER_IMPORT',
  'PREALERT',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type OutboxEventType = AuditActionCode;
