import type {
  AuthenticationMembership,
  AuthenticationUserRecord,
  FailedAuthenticationState,
  OrganizationContext,
  RegisterFailedAuthenticationAttemptInput,
  RegisterSuccessfulAuthenticationInput,
  SuccessfulAuthenticationState,
} from './auth.types';

export abstract class AuthRepository {
  abstract findUserByEmail(
    email: string,
  ): Promise<AuthenticationUserRecord | null>;

  abstract registerFailedAuthenticationAttempt(
    input: RegisterFailedAuthenticationAttemptInput,
  ): Promise<FailedAuthenticationState | null>;

  abstract registerSuccessfulAuthentication(
    input: RegisterSuccessfulAuthenticationInput,
  ): Promise<SuccessfulAuthenticationState | null>;

  abstract findAvailableOrganizationsForUser(
    userId: string,
  ): Promise<AuthenticationMembership[]>;

  abstract findOrganizationContext(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationContext | null>;
}
