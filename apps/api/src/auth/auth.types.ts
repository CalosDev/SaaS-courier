export type AuthenticationUserStatus =
  | 'INVITED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DISABLED';

export type AuthenticationEmployeeStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'TERMINATED';

export type AuthenticationOrganizationStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface AuthenticateCredentialsInput {
  email: string;
  password: string;
}

export interface SelectOrganizationInput {
  userId: string;
  organizationId: string;
}

export interface AuthenticationUserRecord {
  userId: string;
  email: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  status: AuthenticationUserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
}

export interface FailedAuthenticationState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface SuccessfulAuthenticationState {
  blocked: boolean;
  lockedUntil: Date | null;
}

export interface AuthenticationMembership {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  organizationStatus: AuthenticationOrganizationStatus;
  employeeId: string;
  firstName: string;
  lastName: string;
  facilityIds: string[];
  employeeCode?: string;
  primaryFacilityId?: string;
}

export interface AuthenticatedUserResult {
  userId: string;
  email: string;
  organizations: AuthenticationMembership[];
}

export interface OrganizationContext {
  userId: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  facilityIds: string[];
  employeeCode?: string;
  primaryFacilityId?: string;
}

export interface RegisterFailedAuthenticationAttemptInput {
  userId: string;
  occurredAt: Date;
}

export interface RegisterSuccessfulAuthenticationInput {
  userId: string;
  authenticatedAt: Date;
}
