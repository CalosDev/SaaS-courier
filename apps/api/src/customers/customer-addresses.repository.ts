import type {
  CreateCustomerAddressRecord,
  CustomerAddressRecord,
  UpdateCustomerAddressRecord,
} from './customer.types';
import type { CommandContext } from '../request-context/request-context.types';

export abstract class CustomerAddressesRepository {
  abstract listByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerAddressRecord[]>;
  abstract create(
    input: CreateCustomerAddressRecord,
    context?: CommandContext,
  ): Promise<CustomerAddressRecord>;
  abstract update(
    input: UpdateCustomerAddressRecord,
    context?: CommandContext,
  ): Promise<CustomerAddressRecord | null>;
}
