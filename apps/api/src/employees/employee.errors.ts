abstract class EmployeeError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidEmployeeInputError extends EmployeeError {
  readonly code = 'EMPLOYEE_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class EmployeeNotFoundError extends EmployeeError {
  readonly code = 'EMPLOYEE_NOT_FOUND';

  constructor(employeeId: string) {
    super(`Employee not found: ${employeeId}`);
  }
}

export class EmployeeSelfManagementError extends EmployeeError {
  readonly code = 'EMPLOYEE_SELF_MANAGEMENT_FORBIDDEN';

  constructor() {
    super('Employees cannot modify their own access');
  }
}

export class EmployeeCodeConflictError extends EmployeeError {
  readonly code = 'EMPLOYEE_CODE_CONFLICT';

  constructor(employeeCode: string) {
    super(`Employee code already exists: ${employeeCode}`);
  }
}

export class EmployeeMembershipConflictError extends EmployeeError {
  readonly code = 'EMPLOYEE_MEMBERSHIP_CONFLICT';

  constructor() {
    super('Employee membership already exists');
  }
}

export class EmployeeInvitationUserUnavailableError extends EmployeeError {
  readonly code = 'EMPLOYEE_INVITATION_USER_UNAVAILABLE';

  constructor() {
    super('Global user account is not available for invitation');
  }
}

export class EmployeeMaxUsersExceededError extends EmployeeError {
  readonly code = 'EMPLOYEE_MAX_USERS_EXCEEDED';

  constructor() {
    super('Organization maximum users exceeded');
  }
}

export class EmployeeFacilityNotFoundError extends EmployeeError {
  readonly code = 'EMPLOYEE_FACILITY_NOT_FOUND';

  constructor() {
    super('Facility not found for employee assignment');
  }
}

export class EmployeeRoleNotFoundError extends EmployeeError {
  readonly code = 'EMPLOYEE_ROLE_NOT_FOUND';

  constructor() {
    super('Role not found for employee assignment');
  }
}
