import type {
  CreateCustomerRecord,
  CustomerListResult,
  CustomerRecord,
  ListCustomersRecord,
  UpdateCustomerRecord,
} from './customer.types';

export abstract class CustomersRepository {
  abstract createWithGeneratedCode(
    input: Omit<CreateCustomerRecord, 'customerCode'>,
  ): Promise<CustomerRecord>;
  abstract create(input: CreateCustomerRecord): Promise<CustomerRecord>;
  abstract findById(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerRecord | null>;
  abstract list(input: ListCustomersRecord): Promise<CustomerListResult>;
  abstract update(input: UpdateCustomerRecord): Promise<CustomerRecord | null>;
}
