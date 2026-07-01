export const FACILITY_TYPE_VALUES = [
  'INTERNATIONAL_WAREHOUSE',
  'DISTRIBUTION_CENTER',
  'BRANCH',
  'AGENCY',
  'PICKUP_POINT',
  'OFFICE',
  'CUSTOMS_WAREHOUSE',
] as const;

export const FACILITY_OWNERSHIP_TYPE_VALUES = [
  'OWNED',
  'AGENCY',
  'PARTNER',
] as const;

export type FacilityType = (typeof FACILITY_TYPE_VALUES)[number];
export type FacilityOwnershipType =
  (typeof FACILITY_OWNERSHIP_TYPE_VALUES)[number];

export interface FacilityRecord {
  id: string;
  code: string;
  name: string;
  type: FacilityType;
  ownershipType: FacilityOwnershipType;
  countryCode: string;
  province: string | null;
  city: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  phone: string | null;
  email: string | null;
  isCustomerFacing: boolean;
  isPackageOrigin: boolean;
  isDistributionCenter: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFacilityInput {
  code: string;
  name: string;
  type: FacilityType;
  ownershipType?: FacilityOwnershipType;
  countryCode?: string;
  province?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  isCustomerFacing?: boolean;
  isPackageOrigin?: boolean;
  isDistributionCenter?: boolean;
}

export interface CreateFacilityRecord {
  organizationId: string;
  code: string;
  name: string;
  type: FacilityType;
  ownershipType: FacilityOwnershipType;
  countryCode: string;
  province: string | null;
  city: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  phone: string | null;
  email: string | null;
  isCustomerFacing: boolean;
  isPackageOrigin: boolean;
  isDistributionCenter: boolean;
  isActive: boolean;
}

export interface UpdateFacilityInput {
  code?: string;
  name?: string;
  type?: FacilityType;
  ownershipType?: FacilityOwnershipType;
  countryCode?: string;
  province?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  isCustomerFacing?: boolean;
  isPackageOrigin?: boolean;
  isDistributionCenter?: boolean;
  isActive?: boolean;
}

export interface UpdateFacilityRecord {
  organizationId: string;
  facilityId: string;
  code?: string;
  name?: string;
  type?: FacilityType;
  ownershipType?: FacilityOwnershipType;
  countryCode?: string;
  province?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  phone?: string | null;
  email?: string | null;
  isCustomerFacing?: boolean;
  isPackageOrigin?: boolean;
  isDistributionCenter?: boolean;
  isActive?: boolean;
}

export interface ListFacilitiesInput {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  type?: FacilityType;
}

export interface ListFacilitiesRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  isActive?: boolean;
  type?: FacilityType;
}

export interface FacilityListResult {
  items: FacilityRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
