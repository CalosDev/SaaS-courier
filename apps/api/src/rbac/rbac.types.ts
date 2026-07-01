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

export interface ListRolesInput {
  organizationId: string;
  page?: number;
  pageSize?: number;
  q?: string;
  isActive?: boolean;
}

export interface ListRolesRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  isActive?: boolean;
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

export interface RoleDetailRecord extends RoleRecord {
  assignedEmployeeCount: number;
}

export interface RoleListResult {
  items: RoleRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface UpdateRoleInput {
  organizationId: string;
  roleId: string;
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateRoleRecord {
  organizationId: string;
  roleId: string;
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ReplaceRolePermissionsInput {
  organizationId: string;
  roleId: string;
  permissionCodes: string[];
}

export interface ReplaceRolePermissionsRecord {
  organizationId: string;
  roleId: string;
  permissionCodes: string[];
}

export interface PermissionListItem {
  code: string;
  name: string;
  description: string | null;
}
