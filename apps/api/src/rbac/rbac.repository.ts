import type {
  AssignRoleToEmployeeRecord,
  CreateRoleRecord,
  PermissionCatalogSyncResult,
  PermissionDefinition,
  PermissionEvaluationRecord,
  RoleRecord,
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

  abstract findEffectivePermissionCodes(
    input: PermissionEvaluationRecord,
  ): Promise<string[]>;
}
