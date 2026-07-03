import type {
  CustomerCustomsProfileRecord,
  UpdateCustomerCustomsVerificationRecord,
  UpsertCustomerCustomsProfileIdentityRecord,
} from './customer.types';
import type { CommandContext } from '../request-context/request-context.types';

export abstract class CustomerCustomsProfilesRepository {
  abstract findByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerCustomsProfileRecord | null>;
  abstract upsertIdentity(
    input: UpsertCustomerCustomsProfileIdentityRecord,
    context?: CommandContext,
  ): Promise<CustomerCustomsProfileRecord>;
  abstract updateVerification(
    input: UpdateCustomerCustomsVerificationRecord,
    context?: CommandContext,
  ): Promise<CustomerCustomsProfileRecord | null>;
}
