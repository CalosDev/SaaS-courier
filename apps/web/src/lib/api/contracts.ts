import type { PermissionCode } from "@/lib/permissions";

export type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type SessionContext = {
  sessionId: string;
  userId: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  facilityIds: string[];
  expiresAt: string;
  employeeCode?: string;
  primaryFacilityId?: string;
};

export type AuthenticationMembership = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  organizationStatus: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  employeeId: string;
  firstName: string;
  lastName: string;
  facilityIds: string[];
  employeeCode?: string;
  primaryFacilityId?: string;
};

export type LoginResponse =
  | {
      status: "authenticated";
      session: SessionContext;
    }
  | {
      status: "organization_selection_required";
      organizations: AuthenticationMembership[];
    };

export type AuthorizationResponse = {
  permissionCodes: PermissionCode[];
};

export type Organization = {
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
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  planCode: string;
  maxUsers: number;
  maxFacilities: number;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationSettings = {
  locale: string;
  dateFormat: "DMY" | "MDY" | "YMD";
  weightUnit: "LB" | "KG";
  dimensionUnit: "IN" | "CM";
  timezone: string;
  currencyCode: string;
  countryCode: string;
  customerCodeStrategy: "AUTO_RANDOM" | "AUTO_SEQUENTIAL";
  customerCodePrefix: string;
  customerCodeRandomLength: number;
  customerCodeSequencePadding: number;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationCapabilities = {
  planCode: string;
  modules: string[];
  limits: {
    maxUsers: number;
    maxFacilities: number;
  };
  usage: {
    users: number;
    facilities: number;
    customers: number;
  };
};

export type Onboarding = {
  status: "NOT_STARTED" | "IN_PROGRESS" | "READY" | "COMPLETED";
  completedAt: string | null;
  steps: Array<{
    code:
      | "ORGANIZATION_PROFILE"
      | "OPERATIONAL_SETTINGS"
      | "CUSTOMER_CODE_POLICY"
      | "ACTIVE_FACILITY"
      | "ACTIVE_EMPLOYEE"
      | "ACTIVE_ROLE";
    required: true;
    completed: boolean;
  }>;
};

export type Facility = {
  id: string;
  code: string;
  name: string;
  type:
    | "INTERNATIONAL_WAREHOUSE"
    | "DISTRIBUTION_CENTER"
    | "BRANCH"
    | "AGENCY"
    | "PICKUP_POINT"
    | "OFFICE"
    | "CUSTOMS_WAREHOUSE";
  ownershipType: "OWNED" | "AGENCY" | "PARTNER";
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
  createdAt: string;
  updatedAt: string;
};

export type FacilityListResponse = {
  items: Facility[];
  pagination: Pagination;
};

export type Employee = {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "TERMINATED";
  user: {
    id: string;
    email: string;
    status: "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED";
    emailVerifiedAt: string | null;
  };
  facilities: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    isPrimary: boolean;
  }>;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeListResponse = {
  items: Employee[];
  pagination: Pagination;
};

export type EmployeeInvitationResponse = {
  status: "invited" | "membership_created";
  employee: Employee;
  activation: {
    token: string;
    expiresAt: string;
  } | null;
};

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionCodes: string[];
  createdAt: string;
  updatedAt: string;
};

export type RoleDetail = Role & {
  assignedEmployeeCount: number;
};

export type RoleListResponse = {
  items: Role[];
  pagination: Pagination;
};

export type PermissionItem = {
  code: string;
  name: string;
  description: string | null;
};

export type Customer = {
  id: string;
  customerCode: string;
  type: "INDIVIDUAL" | "BUSINESS";
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerListResponse = {
  items: Customer[];
  pagination: Pagination;
};

export type PrealertStatus = "PENDING_ARRIVAL" | "MATCHED" | "CANCELLED";

export type PrealertInvoiceStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "PROVIDED"
  | "REJECTED"
  | "VERIFIED";

export type PrealertCustomerSummary = {
  id: string;
  customerCode: string;
  type: "INDIVIDUAL" | "BUSINESS";
  displayName: string;
};

export type PrealertEmployeeSummary = {
  id: string;
  displayName: string;
};

export type PrealertMatchedPackageSummary = {
  id: string;
  internalTrackingNumber: string;
  status: "RECEPTION_PENDING" | "RECEIVED_AT_ORIGIN" | "CANCELLED";
};

export type PrealertSummary = {
  id: string;
  prealertCode: string;
  externalTrackingNumber: string;
  carrierName: string | null;
  storeName: string;
  purchaseDate: string | null;
  description: string;
  quantity: number;
  declaredValue: string;
  currencyCode: string;
  invoiceStatus: PrealertInvoiceStatus;
  status: PrealertStatus;
  customer: PrealertCustomerSummary;
  matchedPackage: PrealertMatchedPackageSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type PrealertDetail = PrealertSummary & {
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdBy: PrealertEmployeeSummary;
  cancelledBy: PrealertEmployeeSummary | null;
};

export type PrealertListResponse = {
  items: PrealertSummary[];
  pagination: Pagination;
};

export type PackageStatus =
  | "RECEPTION_PENDING"
  | "RECEIVED_AT_ORIGIN"
  | "CANCELLED";

export type PackageSource = "MANUAL" | "PREALERT";

export type PackageCustomerSummary = {
  id: string;
  customerCode: string;
  type: "INDIVIDUAL" | "BUSINESS";
  displayName: string;
};

export type PackagePrealertSummary = {
  id: string;
  prealertCode: string;
  storeName: string;
};

export type PackageEmployeeSummary = {
  id: string;
  displayName: string;
};

export type PackageSummary = {
  id: string;
  internalTrackingNumber: string;
  externalTrackingNumber: string;
  status: PackageStatus;
  source: PackageSource;
  customer: PackageCustomerSummary;
  prealert: PackagePrealertSummary | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PackageDetail = PackageSummary & {
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  registeredBy: PackageEmployeeSummary;
  cancelledBy: PackageEmployeeSummary | null;
};

export type PackageListResponse = {
  items: PackageSummary[];
  pagination: Pagination;
};

export type PackageCondition =
  | "SEALED"
  | "OPEN"
  | "DAMAGED"
  | "WET"
  | "CRUSHED"
  | "OTHER";

export type PackageReception = {
  id: string;
  packageId: string;
  facility: {
    id: string;
    code: string;
    name: string;
  };
  receivedBy: PackageEmployeeSummary;
  weight: string;
  weightUnit: "LB" | "KG";
  length: string;
  width: string;
  height: string;
  dimensionUnit: "IN" | "CM";
  pieceCount: number;
  condition: PackageCondition;
  receivedAt: string;
  createdAt: string;
};

export type CustomerAddress = {
  id: string;
  type: "HOME" | "WORK" | "BILLING" | "DELIVERY" | "OTHER";
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
  createdAt: string;
  updatedAt: string;
};

export type CustomerCustomsProfile = {
  id: string;
  documentType: "CEDULA" | "PASSPORT" | "RNC";
  documentNumber: string;
  ruaStatus:
    | "UNKNOWN"
    | "PENDING"
    | "REGISTERED"
    | "NOT_REGISTERED"
    | "VERIFICATION_FAILED";
  verificationSource: "MANUAL" | "DGA_PORTAL" | "OFFICIAL_INTEGRATION" | null;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  externalReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerImportRow = {
  id: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown> | null;
  status: "PENDING" | "VALID" | "INVALID" | "IMPORTED";
  validationErrors: string[] | null;
  importedCustomerId: string | null;
};

export type CustomerImportJob = {
  id: string;
  name: string | null;
  status: "DRAFT" | "VALIDATED" | "IMPORTING" | "COMPLETED" | "FAILED" | "CANCELLED";
  preserveCustomerCodes: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  rows?: CustomerImportRow[];
};
