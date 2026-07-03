import type {
  CreateCustomerRecord,
  CustomerListResult,
  CustomerRecord,
  ListCustomersRecord,
  UpdateCustomerRecord,
} from './customer.types';
import type { CommandContext } from '../request-context/request-context.types';

export abstract class CustomersRepository {
  abstract createWithGeneratedCode(
    input: Omit<CreateCustomerRecord, 'customerCode'>,
    context?: CommandContext,
  ): Promise<CustomerRecord>;
  abstract create(
    input: CreateCustomerRecord,
    context?: CommandContext,
  ): Promise<CustomerRecord>;
  abstract findById(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerRecord | null>;
  abstract list(input: ListCustomersRecord): Promise<CustomerListResult>;
  abstract update(
    input: UpdateCustomerRecord,
    context?: CommandContext,
  ): Promise<CustomerRecord | null>;
}
