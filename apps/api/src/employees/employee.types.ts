export const EMPLOYEE_STATUS_VALUES = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUS_VALUES)[number];

export interface EmployeeUserRecord {
  id: string;
  email: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  emailVerifiedAt: Date | null;
}

export interface EmployeeFacilityRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  isPrimary: boolean;
}

export interface EmployeeRoleRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface EmployeeDetailRecord {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: EmployeeStatus;
  user: EmployeeUserRecord;
  facilities: EmployeeFacilityRecord[];
  roles: EmployeeRoleRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeInvitationActivationRecord {
  expiresAt: Date;
}

export interface EmployeeInvitationRepositoryResult {
  status: 'invited' | 'membership_created';
  employee: EmployeeDetailRecord;
  activation: EmployeeInvitationActivationRecord | null;
}

export interface EmployeeInvitationResult {
  status: 'invited' | 'membership_created';
  employee: EmployeeDetailRecord;
  activation: {
    token: string;
    expiresAt: Date;
  } | null;
}

export interface InviteEmployeeInput {
  email: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  facilityIds?: string[];
  primaryFacilityId?: string;
  roleIds?: string[];
}

export interface InviteEmployeeRecord {
  organizationId: string;
  email: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  facilityIds: string[];
  primaryFacilityId: string | null;
  roleIds: string[];
  activationTokenHash: string | null;
  activationTokenExpiresAt: Date | null;
  invitedAt: Date;
}

export interface ListEmployeesInput {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: EmployeeStatus;
  facilityId?: string;
  roleId?: string;
}

export interface ListEmployeesRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: EmployeeStatus;
  facilityId?: string;
  roleId?: string;
}

export interface EmployeeListResult {
  items: EmployeeDetailRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface UpdateEmployeeInput {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: EmployeeStatus;
}

export interface UpdateEmployeeRecord {
  organizationId: string;
  employeeId: string;
  employeeCode?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  status?: EmployeeStatus;
}

export interface ReplaceEmployeeFacilitiesInput {
  facilityIds: string[];
  primaryFacilityId?: string;
}

export interface ReplaceEmployeeFacilitiesRecord {
  organizationId: string;
  employeeId: string;
  facilityIds: string[];
  primaryFacilityId: string | null;
}

export interface ReplaceEmployeeRolesInput {
  roleIds: string[];
}

export interface ReplaceEmployeeRolesRecord {
  organizationId: string;
  employeeId: string;
  roleIds: string[];
}

export interface RevokeEmployeeSessionsRecord {
  organizationId: string;
  employeeId: string;
  reason: 'ADMIN_REVOKED' | 'ACCOUNT_CHANGED';
}
