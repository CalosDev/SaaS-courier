import type {
  CustomerIdentityDocumentType,
  CustomerType,
} from '../customers/customer.types';

export const CUSTOMER_IMPORT_JOB_STATUS_VALUES = [
  'DRAFT',
  'VALIDATED',
  'IMPORTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export const CUSTOMER_IMPORT_ROW_STATUS_VALUES = [
  'PENDING',
  'VALID',
  'INVALID',
  'IMPORTED',
] as const;

export type CustomerImportJobStatus =
  (typeof CUSTOMER_IMPORT_JOB_STATUS_VALUES)[number];
export type CustomerImportRowStatus =
  (typeof CUSTOMER_IMPORT_ROW_STATUS_VALUES)[number];

export interface CustomerImportRowInput {
  type?: CustomerType;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  notes?: string;
  customerCode?: string;
  customsProfile?: {
    documentType?: CustomerIdentityDocumentType;
    documentNumber?: string;
    notes?: string;
  };
}

export interface CreateCustomerImportJobInput {
  name?: string;
  preserveCustomerCodes: boolean;
  rows: CustomerImportRowInput[];
}

export interface CreateCustomerImportJobRecord {
  organizationId: string;
  createdByEmployeeId: string;
  name: string | null;
  preserveCustomerCodes: boolean;
  rows: Array<{
    rowNumber: number;
    rawData: CustomerImportRowInput;
  }>;
}

export interface CustomerImportRowRecord {
  id: string;
  rowNumber: number;
  rawData: CustomerImportRowInput;
  normalizedData?: Record<string, unknown> | null;
  status: CustomerImportRowStatus;
  validationErrors?: string[] | null;
  importedCustomerId?: string | null;
}

export interface CustomerImportJobRecord {
  id: string;
  name?: string | null;
  status: CustomerImportJobStatus;
  preserveCustomerCodes: boolean;
  totalRows: number;
  validRows?: number;
  invalidRows?: number;
  importedRows?: number;
  rows?: CustomerImportRowRecord[];
}

export interface CustomerImportValidationConflictSnapshot {
  customerCodes: string[];
  customsIdentities: string[];
}

export interface SaveCustomerImportValidationRecord {
  organizationId: string;
  importJobId: string;
  validRows: number;
  invalidRows: number;
  rows: Array<{
    id: string;
    status: CustomerImportRowStatus;
    normalizedData: Record<string, unknown> | null;
    validationErrors: string[] | null;
  }>;
}
