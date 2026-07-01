export const CUSTOMER_TYPE_VALUES = ['INDIVIDUAL', 'BUSINESS'] as const;
export const CUSTOMER_STATUS_VALUES = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
] as const;
export const CUSTOMER_ADDRESS_TYPE_VALUES = [
  'HOME',
  'WORK',
  'BILLING',
  'DELIVERY',
  'OTHER',
] as const;
export const CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES = [
  'CEDULA',
  'PASSPORT',
  'RNC',
] as const;
export const CUSTOMS_REGISTRATION_STATUS_VALUES = [
  'UNKNOWN',
  'PENDING',
  'REGISTERED',
  'NOT_REGISTERED',
  'VERIFICATION_FAILED',
] as const;
export const CUSTOMS_VERIFICATION_SOURCE_VALUES = [
  'MANUAL',
  'DGA_PORTAL',
  'OFFICIAL_INTEGRATION',
] as const;

export type CustomerType = (typeof CUSTOMER_TYPE_VALUES)[number];
export type CustomerStatus = (typeof CUSTOMER_STATUS_VALUES)[number];
export type CustomerAddressType = (typeof CUSTOMER_ADDRESS_TYPE_VALUES)[number];
export type CustomerIdentityDocumentType =
  (typeof CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES)[number];
export type CustomsRegistrationStatus =
  (typeof CUSTOMS_REGISTRATION_STATUS_VALUES)[number];
export type CustomsVerificationSource =
  (typeof CUSTOMS_VERIFICATION_SOURCE_VALUES)[number];

export interface CustomerRecord {
  id: string;
  customerCode: string;
  type: CustomerType;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  status: CustomerStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerInput {
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  notes?: string;
}

export interface CreateCustomerRecord {
  organizationId: string;
  customerCode: string;
  type: CustomerType;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  status: CustomerStatus;
  notes: string | null;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  status?: CustomerStatus;
  notes?: string;
}

export interface UpdateCustomerRecord {
  organizationId: string;
  customerId: string;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  status?: CustomerStatus;
  notes?: string | null;
}

export interface ListCustomersInput {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: CustomerType;
  status?: CustomerStatus;
}

export interface ListCustomersRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  type?: CustomerType;
  status?: CustomerStatus;
}

export interface CustomerListResult {
  items: CustomerRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CustomerAddressRecord {
  id: string;
  customerId: string;
  type: CustomerAddressType;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  countryCode: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerAddressInput {
  type: CustomerAddressType;
  label?: string;
  recipientName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode?: string;
  countryCode?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface CreateCustomerAddressRecord {
  organizationId: string;
  customerId: string;
  type: CustomerAddressType;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  countryCode: string;
  isPrimary: boolean;
  isActive: boolean;
}

export interface UpdateCustomerAddressInput {
  type?: CustomerAddressType;
  label?: string;
  recipientName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  countryCode?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateCustomerAddressRecord {
  organizationId: string;
  customerId: string;
  addressId: string;
  type?: CustomerAddressType;
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  province?: string;
  postalCode?: string | null;
  countryCode?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface CustomerCustomsProfileRecord {
  id: string;
  customerId: string;
  documentType: CustomerIdentityDocumentType;
  documentNumber: string;
  ruaStatus: CustomsRegistrationStatus;
  verificationSource: CustomsVerificationSource | null;
  lastCheckedAt: Date | null;
  verifiedAt: Date | null;
  externalReference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertCustomerCustomsProfileIdentityInput {
  documentType: CustomerIdentityDocumentType;
  documentNumber: string;
  notes?: string;
}

export interface UpsertCustomerCustomsProfileIdentityRecord {
  organizationId: string;
  customerId: string;
  documentType: CustomerIdentityDocumentType;
  documentNumber: string;
  ruaStatus: CustomsRegistrationStatus;
  verificationSource: CustomsVerificationSource | null;
  lastCheckedAt: Date | null;
  verifiedAt: Date | null;
  externalReference: string | null;
  notes?: string | null;
}

export interface UpdateCustomerCustomsVerificationInput {
  status: CustomsRegistrationStatus;
  source?: CustomsVerificationSource;
  checkedAt?: string;
  externalReference?: string;
  notes?: string;
}

export interface UpdateCustomerCustomsVerificationRecord {
  organizationId: string;
  customerId: string;
  ruaStatus: CustomsRegistrationStatus;
  verificationSource: CustomsVerificationSource | null;
  lastCheckedAt: Date | null;
  verifiedAt: Date | null;
  externalReference: string | null;
  notes?: string | null;
}
