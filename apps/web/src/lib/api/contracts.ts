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

export type ExternalTrackingEvent = {
  timestamp: string;
  status: string;
  location: string;
  description: string;
};

export type ExternalTrackingResponse = {
  trackingNumber: string;
  carrier: string;
  isDelivered: boolean;
  estimatedDelivery: string | null;
  events: ExternalTrackingEvent[];
};

export type DashboardMetrics = {
  pendingPackages: number;
  unmatchedPrealerts: number;
  activeShipments: number;
};

export type ReportType =
  | "OPERATIONS"
  | "INVENTORY"
  | "BILLING"
  | "SHIPMENTS"
  | "CUSTOMS";

export type OperationalReport = {
  generatedAt: string;
  filters: { dateFrom?: string; dateTo?: string };
  data: Record<string, unknown>;
};

export type ReportExportJob = {
  id: string;
  reportType: ReportType;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";
  filters: { dateFrom?: string; dateTo?: string };
  fileName: string | null;
  contentType: string | null;
  rowCount: number | null;
  truncated: boolean;
  errorCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  | "IN_TRANSIT"
  | "ARRIVED_AT_DESTINATION"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
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

export type PackageDocumentType =
  | "INVOICE"
  | "PURCHASE_RECEIPT"
  | "PACKAGE_PHOTO"
  | "DAMAGE_PHOTO"
  | "IDENTITY_SUPPORT"
  | "OTHER";

export type StoredObjectStatus =
  | "PENDING_UPLOAD"
  | "AVAILABLE"
  | "QUARANTINED"
  | "DELETED";

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

export type PackageDocument = {
  id: string;
  packageId: string;
  documentType: PackageDocumentType;
  status: StoredObjectStatus;
  originalFilename: string;
  contentType: string;
  contentLength: number;
  createdBy: PackageEmployeeSummary;
  createdAt: string;
  availableAt: string | null;
  deletedAt: string | null;
};

export type PackageDocumentListResponse = {
  items: PackageDocument[];
};

export type PackageDocumentUploadIntentResponse = {
  document: PackageDocument;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  };
};

export type WarehouseLocationType =
  | "RECEIVING"
  | "SHELF"
  | "RACK"
  | "BIN"
  | "STAGING"
  | "HOLD"
  | "DISPATCH";

export type InventoryMovementType =
  | "PUTAWAY"
  | "MOVE"
  | "HOLD"
  | "RELEASE"
  | "REMOVE";

export type WarehouseLocation = {
  id: string;
  facility: {
    id: string;
    code: string;
    name: string;
  };
  code: string;
  name: string;
  type: WarehouseLocationType;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseLocationListResponse = {
  items: WarehouseLocation[];
  pagination: Pagination;
};

export type InventoryPackage = {
  id: string;
  internalTrackingNumber: string;
  externalTrackingNumber: string;
  status: PackageStatus;
  customer: {
    id: string;
    customerCode: string;
    displayName: string;
  };
  reception: {
    facility: {
      id: string;
      code: string;
      name: string;
    };
    receivedAt: string;
  };
  currentPosition: {
    location: {
      id: string;
      code: string;
      name: string;
      type: WarehouseLocationType;
    };
    placedAt: string;
    updatedAt: string;
  } | null;
};

export type InventoryPackageListResponse = {
  items: InventoryPackage[];
  pagination: Pagination;
};

export type InventoryMovement = {
  id: string;
  packageId: string;
  facility: {
    id: string;
    code: string;
    name: string;
  };
  movementType: InventoryMovementType;
  fromLocation: {
    id: string;
    code: string;
    name: string;
    type: WarehouseLocationType;
  } | null;
  toLocation: {
    id: string;
    code: string;
    name: string;
    type: WarehouseLocationType;
  } | null;
  movedBy: PackageEmployeeSummary;
  note: string | null;
  occurredAt: string;
  createdAt: string;
};

export type InventoryMovementListResponse = {
  items: InventoryMovement[];
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
  status:
    | "DRAFT"
    | "VALIDATED"
    | "IMPORTING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  preserveCustomerCodes: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  rows?: CustomerImportRow[];
};

export type CourierService = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CourierServiceListResponse = {
  items: CourierService[];
  pagination: Pagination;
};

export type RateRule = {
  id: string;
  sortOrder: number;
  minWeight: string | null;
  maxWeight: string | null;
  flatAmountMinor: number | null;
  unitAmountMinor: number | null;
};

export type RateCard = {
  id: string;
  service: {
    id: string;
    code: string;
    name: string;
  };
  name: string;
  segmentKey: string;
  segmentName: string;
  calculationType: "FLAT" | "PER_WEIGHT" | "TIERED_WEIGHT" | "PER_PIECE";
  version: number;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  currencyCode: string;
  weightUnit: "LB" | "KG";
  rules: RateRule[];
  createdAt: string;
  updatedAt: string;
};

export type RateCardListResponse = {
  items: RateCard[];
  pagination: Pagination;
};

export type RateQuote = {
  rateCard: RateCard;
  appliedRule: RateRule;
  quote: {
    weight: string;
    pieceCount: number;
    courierAmountMinor: string;
    customsAmountMinor: string;
    totalAmountMinor: string;
  };
};
export type CustomsCaseStatus =
  | "PENDING_REVIEW"
  | "UNDER_REVIEW"
  | "RELEASED"
  | "HELD"
  | "REJECTED"
  | "CANCELLED";

export type CustomsEventSource =
  | "MANUAL"
  | "OFFICIAL_PORTAL"
  | "AUTHORIZED_INTEGRATION";

export type CustomsCaseEvent = {
  id: string;
  source: CustomsEventSource;
  eventDate: string;
  description: string;
  evidenceReference: string | null;
  recordedByEmployeeId: string | null;
  createdAt: string;
};

export type CustomsCase = {
  id: string;
  organizationId: string;
  caseNumber: string;
  status: CustomsCaseStatus;
  createdAt: string;
  updatedAt: string;
  events?: CustomsCaseEvent[];
};

export type CustomsCaseListResponse = {
  items: CustomsCase[];
  total: number;
};

export type DispatchStatus =
  | "DRAFT"
  | "CLOSED"
  | "DEPARTED"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED";

export interface Dispatch {
  id: string;
  organizationId: string;
  dispatchCode: string;
  status: DispatchStatus;
  origin: string | null;
  destination: string | null;
  originFacilityId?: string | null;
  destinationFacilityId?: string | null;
  transportMode?: "AIR" | "SEA" | "GROUND";
  originFacility?: Pick<Facility, "id" | "code" | "name"> | null;
  destinationFacility?: Pick<Facility, "id" | "code" | "name"> | null;
  departureTime: string | null;
  estimatedArrivalTime: string | null;
  actualArrivalTime: string | null;
  carrier: string | null;
  flightNumber: string | null;
  mawb: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDispatchDto {
  origin?: string;
  destination?: string;
  departureTime?: string;
  estimatedArrivalTime?: string;
  carrier?: string;
  flightNumber?: string;
  mawb?: string;
}

export interface UpdateDispatchDto {
  status?: DispatchStatus;
  origin?: string;
  destination?: string;
  departureTime?: string;
  estimatedArrivalTime?: string;
  actualArrivalTime?: string;
  carrier?: string;
  flightNumber?: string;
  mawb?: string;
}

export interface AddPackagesToDispatchDto {
  packageIds: string[];
}

export interface UpdateMawbDto {
  mawb: string;
}

export type MasterShipmentStatus = DispatchStatus;
export type MasterShipment = Dispatch;
export interface CreateMasterShipmentDto extends CreateDispatchDto {
  originFacilityId: string;
  destinationFacilityId: string;
  transportMode: "AIR" | "SEA" | "GROUND";
}
export type UpdateMasterShipmentDto = UpdateDispatchDto;
export type AddPackagesToMasterShipmentDto = AddPackagesToDispatchDto;

export type HoldStatus = "ACTIVE" | "RELEASED" | "CANCELLED";

export interface OperationalHold {
  id: string;
  organizationId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: HoldStatus;
  releaseReason: string | null;
  requestedByEmployeeId: string;
  releasedByEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
  releasedAt: string | null;
}

export interface CreateHoldDto {
  packageId: string;
  reason: string;
  status?: HoldStatus;
}

export interface UpdateHoldDto {
  status?: HoldStatus;
  reason?: string;
  releaseReason?: string;
}

export type CorrectionStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "CANCELLED";

export type CorrectionTargetType =
  | "PACKAGE"
  | "PREALERT"
  | "MANIFEST"
  | "CUSTOMS_CASE"
  | "INVOICE";

export interface CorrectionRequest {
  id: string;
  organizationId: string;
  targetType: CorrectionTargetType;
  targetId: string;
  reason: string;
  proposedData: Record<string, any>;
  status: CorrectionStatus;
  requestedByEmployeeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCorrectionDto {
  targetType: CorrectionTargetType;
  targetId: string;
  reason: string;
  proposedData: Record<string, any>;
  status?: CorrectionStatus;
}

export interface UpdateCorrectionDto {
  status?: CorrectionStatus;
  reason?: string;
}

export type HouseShipmentStatus = "DRAFT" | "CLOSED" | "CANCELLED";

export interface HouseShipment {
  id: string;
  organizationId: string;
  dispatchId: string;
  hawb: string;
  notes?: string;
  status: HouseShipmentStatus;
  createdAt: string;
  updatedAt: string;
  packages: any[]; // Depending on what is returned
}

export interface CreateHouseShipmentDto {
  hawb: string;
  notes?: string;
}

export interface UpdateHouseShipmentDto {
  hawb?: string;
  notes?: string;
}

export interface AddPackagesToHouseShipmentDto {
  packageIds: string[];
}

export type CustomsManifestStatus =
  | "DRAFT"
  | "VALIDATED"
  | "FINALIZED"
  | "CANCELLED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

export interface CustomsManifestPackageSummary {
  id: string;
  internalTrackingNumber: string;
  externalTrackingNumber: string;
  status: PackageStatus;
}

export interface CustomsManifest {
  id: string;
  organizationId: string;
  code: string;
  dispatchId: string | null;
  flightNumber: string;
  arrivalDate: string | null;
  status: CustomsManifestStatus;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  finalizedVersionId: string | null;
  dispatch?: MasterShipment | null;
  versions?: CustomsManifestVersion[];
  finalizedVersion?: CustomsManifestVersion | null;
  packages?: CustomsManifestPackageSummary[];
}

export interface CustomsManifestItem {
  id: string;
  packageId: string;
  itemSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface CustomsManifestVersion {
  id: string;
  versionNumber: number;
  validationStatus: "PENDING" | "VALID" | "INVALID";
  validationErrors: string[] | null;
  shipmentSnapshot: Record<string, unknown>;
  createdAt: string;
  items: CustomsManifestItem[];
}

export interface CreateCustomsManifestDto {
  masterShipmentId: string;
  flightNumber: string;
  arrivalDate?: string;
}

export interface UpdateCustomsManifestDto {
  flightNumber?: string;
  arrivalDate?: string;
}

export interface AddPackagesToCustomsManifestDto {
  packageIds: string[];
}

export interface CreateCustomsCaseDto {
  caseNumber: string;
}

export interface RecordCustomsEventDto {
  source: CustomsEventSource;
  eventDate: string;
  description: string;
  evidenceReference?: string;
}

export interface ChangeCustomsCaseStatusDto {
  status: CustomsCaseStatus;
}

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "VOID";
export type PaymentStatus = "RECORDED" | "APPLIED" | "VOID";
export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
export type InvoiceLineType =
  | "TRANSPORT"
  | "STORAGE"
  | "INSURANCE"
  | "DELIVERY"
  | "HANDLING"
  | "OTHER";

export interface InvoiceLineRecord {
  id: string;
  type: InvoiceLineType;
  description: string;
  quantity: number;
  unitPriceMinor: string;
  totalPriceMinor: string;
}

export interface InvoiceRecord {
  id: string;
  customerId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currencyCode: string;
  subtotalMinor: string;
  taxMinor: string;
  totalMinor: string;
  balanceDueMinor: string;
  issuedAt: string | null;
  dueDate: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: InvoiceLineRecord[];
}

export interface PaymentAllocationRecord {
  id: string;
  paymentId: string;
  invoiceId: string;
  amountMinor: string;
  appliedAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  paymentNumber: string;
  method: PaymentMethod;
  amountMinor: string;
  currencyCode: string;
  reference: string | null;
  status: PaymentStatus;
  recordedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  allocations: PaymentAllocationRecord[];
}

export interface CreateInvoiceDto {
  customerId: string;
  currencyCode: string;
  dueDate?: string;
  notes?: string;
  lines: Omit<InvoiceLineRecord, "id" | "totalPriceMinor">[];
}

export interface UpdateInvoiceDto {
  dueDate?: string;
  notes?: string;
  lines?: Omit<InvoiceLineRecord, "id" | "totalPriceMinor">[];
}

export interface VoidReasonDto {
  reason: string;
}

export interface CreatePaymentDto {
  customerId: string;
  method: PaymentMethod;
  amountMinor: string;
  currencyCode: string;
  reference?: string;
}

export interface ApplyPaymentDto {
  invoiceId: string;
  amountMinor: string;
}

export type PickupRequestStatus = "DRAFT" | "READY" | "COMPLETED" | "CANCELLED";

export interface PickupRequestItemRecord {
  id: string;
  packageId: string;
  pickupRequestId: string;
  createdAt: string;
}

export interface PickupRequestRecord {
  id: string;
  facilityId: string;
  customerId: string;
  pickupNumber: string;
  status: PickupRequestStatus;
  requestedByEmployeeId: string;
  completedByEmployeeId: string | null;
  cancelledByEmployeeId: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PickupRequestItemRecord[];
}

export interface CreatePickupRequestDto {
  facilityId: string;
  customerId: string;
  packageIds: string[];
}

export interface UpdatePickupRequestDto {
  packageIds?: string[];
}

export interface PublicTrackingResult {
  organization: { slug: string; name: string };
  referenceType:
    | "INTERNAL_TRACKING"
    | "EXTERNAL_TRACKING"
    | "PREALERT_CODE";
  internalTrackingNumber: string | null;
  status: string;
  timeline: Array<{
    eventType: string;
    location: string | null;
    createdAt: string;
  }>;
}

export type FacilityTransferStatus =
  | "DRAFT"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED";
export type FacilityTransferItemStatus =
  | "PENDING"
  | "RECEIVED"
  | "MISSING"
  | "DAMAGED";

export interface FacilityTransferItem {
  id: string;
  packageId: string;
  status: FacilityTransferItemStatus;
  receivedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityTransfer {
  id: string;
  transferNumber: string;
  originFacilityId: string;
  destinationFacilityId: string;
  status: FacilityTransferStatus;
  notes?: string;
  dispatchedAt?: string;
  dispatchedById?: string;
  receivedAt?: string;
  receivedById?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  items?: FacilityTransferItem[];
}

export interface CreateTransferDto {
  originFacilityId: string;
  destinationFacilityId: string;
  notes?: string;
}

export interface AddTransferItemDto {
  packageId: string;
}

export interface ReceiveTransferItemDto {
  status: FacilityTransferItemStatus;
  destinationLocationId?: string;
  notes?: string;
}

export type DeliveryMethod =
  | "HOME_DELIVERY"
  | "THIRD_PARTY"
  | "COUNTER_HANDOFF";
export type DeliveryStatus =
  | "DRAFT"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";
export type DeliveryAttemptResult =
  | "DELIVERED"
  | "NOT_HOME"
  | "REJECTED"
  | "ADDRESS_ISSUE"
  | "OTHER";

export interface DeliveryAttempt {
  id: string;
  result: DeliveryAttemptResult;
  notes?: string | null;
  receiverName?: string | null;
  attemptedAt: string;
}

export interface DeliveryOrder {
  id: string;
  deliveryNumber: string;
  customerId: string;
  method: DeliveryMethod;
  status: DeliveryStatus;
  deliveryAddressSnap?: Record<string, unknown> | null;
  notes?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  customer?: Pick<
    Customer,
    | "id"
    | "customerCode"
    | "displayName"
    | "firstName"
    | "lastName"
    | "businessName"
  >;
  items: Array<{ id: string; packageId: string; package?: PackageSummary }>;
  attempts?: DeliveryAttempt[];
}

export interface CreateDeliveryDto {
  deliveryNumber: string;
  customerId: string;
  method: DeliveryMethod;
  deliveryAddressSnap?: Record<string, unknown>;
  notes?: string;
  assignedToId?: string;
  packageIds: string[];
}

export interface RecordDeliveryAttemptDto {
  result: DeliveryAttemptResult;
  notes?: string;
  receiverName?: string;
}

export type WarehouseLookupResult =
  | {
      kind: "PACKAGE";
      package: {
        id: string;
        internalTrackingNumber: string;
        externalTrackingNumber: string;
        prealertCode: string | null;
        status: string;
        customerCode: string;
        reception: {
          facility: { id: string; code: string; name: string };
          receivedAt: string;
        } | null;
        currentLocation: {
          id: string;
          code: string;
          name: string;
          type: WarehouseLocationType;
        } | null;
      };
    }
  | {
      kind: "PREALERT";
      prealert: {
        id: string;
        prealertCode: string;
        externalTrackingNumber: string;
        status: string;
        customerCode: string;
      };
    };

export interface WarehouseBatchPutawayResult {
  location: { id: string; code: string; name: string };
  summary: {
    requested: number;
    placed: number;
    failed: number;
    skipped: number;
  };
  results: Array<{
    code: string;
    packageId?: string;
    internalTrackingNumber?: string;
    status: "PLACED" | "ALREADY_PLACED" | "FAILED" | "SKIPPED";
    reasonCode?: string;
    locationCode?: string;
  }>;
}

export interface NotificationTemplate {
  id: string;
  code: string;
  eventType: string;
  channel: "EMAIL";
  subjectTemplate: string;
  bodyTemplate: string;
  allowedVariables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDelivery {
  id: string;
  template: { code: string; eventType: string };
  channel: "EMAIL";
  recipient: string;
  subject: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "DEAD_LETTER";
  attempts: number;
  lastErrorCode: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CarrierConnection {
  id: string;
  carrierCode: "UPS" | "FEDEX" | "DHL";
  displayName: string;
  connectionKey?: string;
  status: "ACTIVE" | "DISABLED" | "ERROR";
  credentialConfigured: boolean;
  lastTestedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  test?: { success: boolean; errorCode: string | null };
}

export interface CarrierEvent {
  id: string;
  carrier: { carrierCode: string; displayName: string };
  status: "IN_TRANSIT" | "DELIVERED" | "EXCEPTION" | "UNKNOWN";
  occurredAt: string;
  location: string | null;
  description: string | null;
}

export interface SystemReadiness {
  status: "ready" | "not_ready";
  service: "courier-api";
  checks: {
    database: "up" | "down";
    objectStorage: "up" | "down" | "optional";
    smtp: "configured" | "missing" | "optional";
  };
  timestamp: string;
}
