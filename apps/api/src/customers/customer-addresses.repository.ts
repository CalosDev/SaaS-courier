import type {
  CreateCustomerAddressRecord,
  CustomerAddressRecord,
  UpdateCustomerAddressRecord,
} from './customer.types';

export abstract class CustomerAddressesRepository {
  abstract listByCustomerId(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerAddressRecord[]>;
  abstract create(
    input: CreateCustomerAddressRecord,
  ): Promise<CustomerAddressRecord>;
  abstract update(
    input: UpdateCustomerAddressRecord,
  ): Promise<CustomerAddressRecord | null>;
}
