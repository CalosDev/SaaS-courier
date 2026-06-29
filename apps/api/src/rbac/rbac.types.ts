export interface PermissionDefinition {
  code: string;
  name: string;
  description: string;
}

export interface PermissionCatalogSyncResult {
  inserted: number;
  updated: number;
  reactivated: number;
  unchanged: number;
  totalActiveCatalogPermissions: number;
}

export interface CreateRoleInput {
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  permissionCodes?: string[];
}

export interface CreateRoleRecord {
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  permissionCodes: string[];
  isSystem: false;
}

export interface AssignRoleToEmployeeInput {
  organizationId: string;
  employeeId: string;
  roleId: string;
}

export interface AssignRoleToEmployeeRecord {
  organizationId: string;
  employeeId: string;
  roleId: string;
}

export interface PermissionEvaluationInput {
  organizationId: string;
  employeeId: string;
}

export interface PermissionEvaluationRecord {
  organizationId: string;
  employeeId: string;
}

export interface HasPermissionInput extends PermissionEvaluationInput {
  permissionCode: string;
}

export interface RoleRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  permissionCodes: string[];
}
