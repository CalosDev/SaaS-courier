import type {
  CreateCustomerImportJobRecord,
  CustomerImportJobRecord,
  CustomerImportValidationConflictSnapshot,
  SaveCustomerImportValidationRecord,
} from './customer-imports.types';

export abstract class CustomerImportsRepository {
  abstract createDraft(
    input: CreateCustomerImportJobRecord,
  ): Promise<CustomerImportJobRecord>;

  abstract listJobs(organizationId: string): Promise<CustomerImportJobRecord[]>;

  abstract findJobById(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord | null>;

  abstract findValidationConflicts(input: {
    organizationId: string;
    customerCodes: string[];
    customsIdentities: Array<{
      documentType: string;
      documentNumber: string;
    }>;
  }): Promise<CustomerImportValidationConflictSnapshot>;

  abstract saveValidationResult(
    input: SaveCustomerImportValidationRecord,
  ): Promise<CustomerImportJobRecord>;

  abstract commitJob(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord>;

  abstract cancelJob(
    organizationId: string,
    importJobId: string,
  ): Promise<CustomerImportJobRecord | null>;
}
