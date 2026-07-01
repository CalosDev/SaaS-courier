import type {
  EmployeeDetailRecord,
  EmployeeInvitationRepositoryResult,
  EmployeeListResult,
  InviteEmployeeRecord,
  ListEmployeesRecord,
  ReplaceEmployeeFacilitiesRecord,
  ReplaceEmployeeRolesRecord,
  UpdateEmployeeRecord,
} from './employee.types';

export abstract class EmployeesRepository {
  abstract inviteEmployee(
    input: InviteEmployeeRecord,
  ): Promise<EmployeeInvitationRepositoryResult>;

  abstract listEmployees(
    input: ListEmployeesRecord,
  ): Promise<EmployeeListResult>;

  abstract findEmployeeById(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDetailRecord | null>;

  abstract updateEmployee(
    input: UpdateEmployeeRecord,
  ): Promise<EmployeeDetailRecord | null>;

  abstract replaceEmployeeFacilities(
    input: ReplaceEmployeeFacilitiesRecord,
  ): Promise<EmployeeDetailRecord | null>;

  abstract replaceEmployeeRoles(
    input: ReplaceEmployeeRolesRecord,
  ): Promise<EmployeeDetailRecord | null>;
}
