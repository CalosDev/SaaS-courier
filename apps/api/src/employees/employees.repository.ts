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
import type { CommandContext } from '../request-context/request-context.types';

export abstract class EmployeesRepository {
  abstract inviteEmployee(
    input: InviteEmployeeRecord,
    context?: CommandContext,
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
    context?: CommandContext,
  ): Promise<EmployeeDetailRecord | null>;

  abstract replaceEmployeeFacilities(
    input: ReplaceEmployeeFacilitiesRecord,
    context?: CommandContext,
  ): Promise<EmployeeDetailRecord | null>;

  abstract replaceEmployeeRoles(
    input: ReplaceEmployeeRolesRecord,
    context?: CommandContext,
  ): Promise<EmployeeDetailRecord | null>;

  revokeEmployeeSessions?(
    organizationId: string,
    employeeId: string,
    context: CommandContext,
  ): Promise<number | null>;
}
