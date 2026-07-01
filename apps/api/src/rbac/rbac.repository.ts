import type {
  AssignRoleToEmployeeRecord,
  CreateRoleRecord,
  ListRolesRecord,
  PermissionListItem,
  PermissionCatalogSyncResult,
  PermissionDefinition,
  PermissionEvaluationRecord,
  ReplaceRolePermissionsRecord,
  RoleDetailRecord,
  RoleListResult,
  RoleRecord,
  UpdateRoleRecord,
} from './rbac.types';

export abstract class RbacRepository {
  abstract syncPermissionCatalog(
    definitions: readonly PermissionDefinition[],
  ): Promise<PermissionCatalogSyncResult>;

  abstract createRoleWithPermissions(
    input: CreateRoleRecord,
  ): Promise<RoleRecord>;

  abstract assignRoleToEmployee(
    input: AssignRoleToEmployeeRecord,
  ): Promise<void>;

  abstract listRoles(input: ListRolesRecord): Promise<RoleListResult>;

  abstract findRoleById(
    organizationId: string,
    roleId: string,
  ): Promise<RoleDetailRecord | null>;

  abstract updateRole(
    input: UpdateRoleRecord,
  ): Promise<RoleDetailRecord | null>;

  abstract replaceRolePermissions(
    input: ReplaceRolePermissionsRecord,
  ): Promise<RoleDetailRecord | null>;

  abstract listActivePermissions(): Promise<PermissionListItem[]>;

  abstract findEffectivePermissionCodes(
    input: PermissionEvaluationRecord,
  ): Promise<string[]>;
}
