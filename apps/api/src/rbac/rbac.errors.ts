abstract class RbacError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidRoleInputError extends RbacError {
  readonly code = 'RBAC_INVALID_ROLE_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class UnknownPermissionCodeError extends RbacError {
  readonly code = 'RBAC_UNKNOWN_PERMISSION_CODE';

  constructor(permissionCode: string) {
    super(`Unknown permission code: ${permissionCode}`);
  }
}

export class PermissionCatalogNotSynchronizedError extends RbacError {
  readonly code = 'RBAC_PERMISSION_CATALOG_NOT_SYNCHRONIZED';

  constructor() {
    super('Permission catalog is not synchronized');
  }
}

export class RoleCodeConflictError extends RbacError {
  readonly code = 'RBAC_ROLE_CODE_CONFLICT';

  constructor(roleCode: string) {
    super(`Role code already exists: ${roleCode}`);
  }
}

export class RoleNotFoundError extends RbacError {
  readonly code = 'RBAC_ROLE_NOT_FOUND';

  constructor(roleId: string) {
    super(`Role not found: ${roleId}`);
  }
}

export class EmployeeRoleConflictError extends RbacError {
  readonly code = 'RBAC_EMPLOYEE_ROLE_CONFLICT';

  constructor() {
    super('Employee role assignment already exists');
  }
}

export class RbacScopeMismatchError extends RbacError {
  readonly code = 'RBAC_SCOPE_MISMATCH';

  constructor() {
    super('RBAC scope mismatch');
  }
}

export class SystemRoleImmutableError extends RbacError {
  readonly code = 'RBAC_SYSTEM_ROLE_IMMUTABLE';

  constructor() {
    super('System roles cannot be modified');
  }
}
