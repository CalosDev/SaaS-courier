import type {
  CustomerCustomsProfileRecord,
  UpdateCustomerCustomsVerificationRecord,
  UpsertCustomerCustomsProfileIdentityRecord,
} from './customer.types';

export abstract class CustomerCustomsProfilesRepository {
  abstract findByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerCustomsProfileRecord | null>;
  abstract upsertIdentity(
    input: UpsertCustomerCustomsProfileIdentityRecord,
  ): Promise<CustomerCustomsProfileRecord>;
  abstract updateVerification(
    input: UpdateCustomerCustomsVerificationRecord,
  ): Promise<CustomerCustomsProfileRecord | null>;
}
