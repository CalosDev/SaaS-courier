export type OrganizationStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export interface CreateOrganizationInput {
  legalName: string;
  commercialName: string;
  slug: string;
  rnc?: string;
  email?: string;
  phone?: string;
}

export interface CreateOrganizationRecord {
  legalName: string;
  commercialName: string;
  slug: string;
  rnc: string | null;
  email: string | null;
  phone: string | null;
}

export interface OrganizationRecord {
  id: string;
  legalName: string;
  commercialName: string;
  slug: string;
  rnc: string | null;
  email: string | null;
  phone: string | null;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  status: OrganizationStatus;
  planCode: string;
  maxUsers: number;
  maxFacilities: number;
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
