import type {
  CourierRegistrationStatus,
  ElectronicInvoicingStatus,
} from '../organizations/organization-regulatory-profile.types';
import type {
  FacilityOwnershipType,
  FacilityType,
} from '../facilities/facility.types';

export interface ProvisionOrganizationInput {
  organization: {
    legalName: string;
    commercialName: string;
    slug: string;
    rnc: string;
    email: string;
    phone?: string;
    planCode?: string;
    maxUsers?: number;
    maxFacilities?: number;
    trialDays?: number;
  };
  regulatoryProfile: {
    fiscalAddress: string;
    authorizedRepresentativeName: string;
    authorizedRepresentativeEmail?: string;
    authorizedRepresentativePhone?: string;
    courierRegistrationStatus: CourierRegistrationStatus;
    dgaOperatorCode?: string;
    electronicInvoicingStatus: ElectronicInvoicingStatus;
  };
  primaryFacility: {
    code: string;
    name: string;
    type: FacilityType;
    ownershipType?: FacilityOwnershipType;
    countryCode?: string;
    province?: string;
    city?: string;
    addressLine1: string;
    addressLine2?: string;
    phone?: string;
    email?: string;
    isCustomerFacing?: boolean;
    isPackageOrigin?: boolean;
    isDistributionCenter?: boolean;
  };
  administrator: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    employeeCode?: string;
  };
}

export interface ProvisionOrganizationResult {
  organizationId: string;
  organizationSlug: string;
  facilityId: string;
  administratorEmployeeId: string;
  administratorEmail: string;
  activationToken: string;
  activationExpiresAt: Date;
}
