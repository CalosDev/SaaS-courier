export const COURIER_REGISTRATION_STATUS_VALUES = [
  'UNKNOWN',
  'IN_PROCESS',
  'AUTHORIZED',
  'SUSPENDED',
  'REVOKED',
] as const;

export const ELECTRONIC_INVOICING_STATUS_VALUES = [
  'UNKNOWN',
  'NOT_ENROLLED',
  'IN_PROCESS',
  'ENABLED',
  'EXEMPT',
] as const;

export type CourierRegistrationStatus =
  (typeof COURIER_REGISTRATION_STATUS_VALUES)[number];
export type ElectronicInvoicingStatus =
  (typeof ELECTRONIC_INVOICING_STATUS_VALUES)[number];

export interface OrganizationRegulatoryProfileRecord {
  organizationId: string;
  fiscalAddress: string | null;
  authorizedRepresentativeName: string | null;
  authorizedRepresentativeEmail: string | null;
  authorizedRepresentativePhone: string | null;
  courierRegistrationStatus: CourierRegistrationStatus;
  dgaOperatorCode: string | null;
  electronicInvoicingStatus: ElectronicInvoicingStatus;
  declaredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOrganizationRegulatoryProfileInput {
  fiscalAddress?: string;
  authorizedRepresentativeName?: string;
  authorizedRepresentativeEmail?: string;
  authorizedRepresentativePhone?: string;
  courierRegistrationStatus?: CourierRegistrationStatus;
  dgaOperatorCode?: string;
  electronicInvoicingStatus?: ElectronicInvoicingStatus;
}

export interface UpdateOrganizationRegulatoryProfileRecord {
  organizationId: string;
  fiscalAddress?: string | null;
  authorizedRepresentativeName?: string | null;
  authorizedRepresentativeEmail?: string | null;
  authorizedRepresentativePhone?: string | null;
  courierRegistrationStatus?: CourierRegistrationStatus;
  dgaOperatorCode?: string | null;
  electronicInvoicingStatus?: ElectronicInvoicingStatus;
  declaredAt: Date;
}
