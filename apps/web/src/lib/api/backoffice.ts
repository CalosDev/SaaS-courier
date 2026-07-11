"use client";

import { apiClient } from "@/lib/api/client";
import type {
  AuthorizationResponse,
  Customer,
  CustomerAddress,
  CustomerCustomsProfile,
  CustomerImportJob,
  CustomerListResponse,
  DashboardMetrics,
  Employee,
  EmployeeInvitationResponse,
  EmployeeListResponse,
  ExternalTrackingResponse,
  Facility,
  FacilityListResponse,
  InventoryMovementListResponse,
  InventoryPackage,
  InventoryPackageListResponse,
  Onboarding,
  Organization,
  OrganizationCapabilities,
  OrganizationSettings,
  PackageDetail,
  PackageDocument,
  PackageDocumentListResponse,
  PackageDocumentUploadIntentResponse,
  PackageReception,
  PackageListResponse,
  PackageSummary,
  PermissionItem,
  PrealertDetail,
  PrealertListResponse,
  Role,
  RoleDetail,
  RoleListResponse,
  WarehouseLocation,
  WarehouseLocationListResponse,
  CourierService,
  CourierServiceListResponse,
  RateCard,
  RateCardListResponse,
  RateQuote,
  CustomsCase,
  CustomsCaseListResponse,
  CustomsCaseEvent,
  Dispatch,
  MasterShipment,
  CreateMasterShipmentDto,
  UpdateMasterShipmentDto,
  UpdateMawbDto,
  AddPackagesToMasterShipmentDto,
  CreateDispatchDto,
  UpdateDispatchDto,
  AddPackagesToDispatchDto,
  OperationalHold,
  CreateHoldDto,
  UpdateHoldDto,
  CorrectionRequest,
  CreateCorrectionDto,
  UpdateCorrectionDto,
  HouseShipment,
  CreateHouseShipmentDto,
  UpdateHouseShipmentDto,
  AddPackagesToHouseShipmentDto,
  CustomsManifest,
  CreateCustomsManifestDto,
  UpdateCustomsManifestDto,
  AddPackagesToCustomsManifestDto,
  CreateCustomsCaseDto,
  RecordCustomsEventDto,
  ChangeCustomsCaseStatusDto,
  InvoiceRecord,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  VoidReasonDto,
  PaymentRecord,
  CreatePaymentDto,
  ApplyPaymentDto,
  PickupRequestRecord,
  CreatePickupRequestDto,
  UpdatePickupRequestDto,
  FacilityTransfer,
  CreateTransferDto,
  AddTransferItemDto,
  DispatchTransferDto,
  ReceiveTransferItemDto,
} from "@/lib/api/contracts";

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const backofficeApi = {
  getSession() {
    return apiClient.get<{ session: import("@/lib/api/contracts").SessionContext }>(
      "/auth/session",
    );
  },
  getAuthorization() {
    return apiClient.get<AuthorizationResponse>("/auth/authorization");
  },
  getCurrentOrganization() {
    return apiClient.get<Organization>("/organizations/current");
  },
  updateCurrentOrganization(body: Partial<Organization>) {
    return apiClient.patch<Organization>("/organizations/current", body);
  },
  getCurrentSettings() {
    return apiClient.get<OrganizationSettings>("/organizations/current/settings");
  },
  updateCurrentSettings(body: Partial<OrganizationSettings>) {
    return apiClient.patch<OrganizationSettings>(
      "/organizations/current/settings",
      body,
    );
  },
  getCapabilities() {
    return apiClient.get<OrganizationCapabilities>(
      "/organizations/current/capabilities",
    );
  },
  getOnboarding() {
    return apiClient.get<Onboarding>("/organizations/current/onboarding");
  },
  completeOnboarding() {
    return apiClient.post<Onboarding>("/organizations/current/onboarding/complete", {});
  },
  getDashboardMetrics() {
    return apiClient.get<DashboardMetrics>("/reports/dashboard-metrics");
  },
  listFacilities(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<FacilityListResponse>(
      `/facilities${buildQuery(params)}`,
    );
  },
  getFacility(facilityId: string) {
    return apiClient.get<Facility>(`/facilities/${facilityId}`);
  },
  createFacility(body: Record<string, unknown>) {
    return apiClient.post<Facility>("/facilities", body);
  },
  updateFacility(facilityId: string, body: Record<string, unknown>) {
    return apiClient.patch<Facility>(`/facilities/${facilityId}`, body);
  },
  listInventoryLocations(
    params: Record<string, string | number | boolean | undefined>,
  ) {
    return apiClient.get<WarehouseLocationListResponse>(
      `/inventory/locations${buildQuery(params)}`,
    );
  },
  createInventoryLocation(body: Record<string, unknown>) {
    return apiClient.post<WarehouseLocation>("/inventory/locations", body);
  },
  updateInventoryLocation(locationId: string, body: Record<string, unknown>) {
    return apiClient.patch<WarehouseLocation>(
      `/inventory/locations/${locationId}`,
      body,
    );
  },
  listInventoryPackages(
    params: Record<string, string | number | boolean | undefined>,
  ) {
    return apiClient.get<InventoryPackageListResponse>(
      `/inventory/packages${buildQuery(params)}`,
    );
  },
  moveInventoryPackage(packageId: string, body: Record<string, unknown>) {
    return apiClient.post<InventoryPackage>(
      `/inventory/packages/${packageId}/move`,
      body,
    );
  },
  listPackageInventoryMovements(packageId: string) {
    return apiClient.get<InventoryMovementListResponse>(
      `/inventory/packages/${packageId}/movements`,
    );
  },
  listEmployees(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<EmployeeListResponse>(
      `/employees${buildQuery(params)}`,
    );
  },
  inviteEmployee(body: Record<string, unknown>) {
    return apiClient.post<EmployeeInvitationResponse>("/employees/invitations", body);
  },
  getEmployee(employeeId: string) {
    return apiClient.get<Employee>(`/employees/${employeeId}`);
  },
  updateEmployee(employeeId: string, body: Record<string, unknown>) {
    return apiClient.patch<Employee>(`/employees/${employeeId}`, body);
  },
  replaceEmployeeRoles(employeeId: string, roleIds: string[]) {
    return apiClient.put<Employee>(`/employees/${employeeId}/roles`, { roleIds });
  },
  replaceEmployeeFacilities(
    employeeId: string,
    facilityIds: string[],
    primaryFacilityId: string | null,
  ) {
    return apiClient.put<Employee>(`/employees/${employeeId}/facilities`, {
      facilityIds,
      primaryFacilityId,
    });
  },
  revokeEmployeeSessions(employeeId: string) {
    return apiClient.post<void>(`/employees/${employeeId}/revoke-sessions`, {});
  },
  listRoles(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<RoleListResponse>(`/roles${buildQuery(params)}`);
  },
  createRole(body: Record<string, unknown>) {
    return apiClient.post<Role>("/roles", body);
  },
  getRole(roleId: string) {
    return apiClient.get<RoleDetail>(`/roles/${roleId}`);
  },
  updateRole(roleId: string, body: Record<string, unknown>) {
    return apiClient.patch<RoleDetail>(`/roles/${roleId}`, body);
  },
  replaceRolePermissions(roleId: string, permissionCodes: string[]) {
    return apiClient.put<RoleDetail>(`/roles/${roleId}/permissions`, {
      permissionCodes,
    });
  },
  listPermissions() {
    return apiClient.get<PermissionItem[]>("/permissions");
  },
  listCustomers(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<CustomerListResponse>(
      `/customers${buildQuery(params)}`,
    );
  },
  createCustomer(body: Record<string, unknown>) {
    return apiClient.post<Customer>("/customers", body);
  },
  getCustomer(customerId: string) {
    return apiClient.get<Customer>(`/customers/${customerId}`);
  },
  updateCustomer(customerId: string, body: Record<string, unknown>) {
    return apiClient.patch<Customer>(`/customers/${customerId}`, body);
  },
  listCustomerAddresses(customerId: string) {
    return apiClient.get<CustomerAddress[]>(`/customers/${customerId}/addresses`);
  },
  createCustomerAddress(customerId: string, body: Record<string, unknown>) {
    return apiClient.post<CustomerAddress>(
      `/customers/${customerId}/addresses`,
      body,
    );
  },
  updateCustomerAddress(
    customerId: string,
    addressId: string,
    body: Record<string, unknown>,
  ) {
    return apiClient.patch<CustomerAddress>(
      `/customers/${customerId}/addresses/${addressId}`,
      body,
    );
  },
  getCustomerCustomsProfile(customerId: string) {
    return apiClient.get<CustomerCustomsProfile>(
      `/customers/${customerId}/customs-profile`,
    );
  },
  upsertCustomerCustomsProfile(
    customerId: string,
    body: Record<string, unknown>,
  ) {
    return apiClient.put<CustomerCustomsProfile>(
      `/customers/${customerId}/customs-profile`,
      body,
    );
  },
  updateCustomerCustomsVerification(
    customerId: string,
    body: Record<string, unknown>,
  ) {
    return apiClient.patch<CustomerCustomsProfile>(
      `/customers/${customerId}/customs-profile/verification`,
      body,
    );
  },
  listCustomerImports() {
    return apiClient.get<CustomerImportJob[]>("/customer-imports");
  },
  createCustomerImport(body: Record<string, unknown>) {
    return apiClient.post<CustomerImportJob>("/customer-imports", body);
  },
  getCustomerImport(importId: string) {
    return apiClient.get<CustomerImportJob>(`/customer-imports/${importId}`);
  },
  validateCustomerImport(importId: string) {
    return apiClient.post<CustomerImportJob>(
      `/customer-imports/${importId}/validate`,
      {},
    );
  },
  commitCustomerImport(importId: string) {
    return apiClient.post<CustomerImportJob>(
      `/customer-imports/${importId}/commit`,
      {},
    );
  },
  cancelCustomerImport(importId: string) {
    return apiClient.post<CustomerImportJob>(
      `/customer-imports/${importId}/cancel`,
      {},
    );
  },
  listPrealerts(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<PrealertListResponse>(
      `/prealerts${buildQuery(params)}`,
    );
  },
  createPrealert(body: Record<string, unknown>) {
    return apiClient.post<PrealertDetail>("/prealerts", body);
  },
  getPrealert(prealertId: string) {
    return apiClient.get<PrealertDetail>(`/prealerts/${prealertId}`);
  },
  getExternalTracking(prealertId: string) {
    return apiClient.get<ExternalTrackingResponse>(`/prealerts/${prealertId}/external-tracking`);
  },
  updatePrealert(prealertId: string, body: Record<string, unknown>) {
    return apiClient.patch<PrealertDetail>(`/prealerts/${prealertId}`, body);
  },
  cancelPrealert(prealertId: string, reason: string) {
    return apiClient.post<PrealertDetail>(`/prealerts/${prealertId}/cancel`, {
      reason,
    });
  },
  listPackages(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<PackageListResponse>(
      `/packages${buildQuery(params)}`,
    );
  },
  createPackage(body: Record<string, unknown>) {
    return apiClient.post<PackageSummary>("/packages", body);
  },
  getPackage(packageId: string) {
    return apiClient.get<PackageDetail>(`/packages/${packageId}`);
  },
  updatePackage(packageId: string, body: Record<string, unknown>) {
    return apiClient.patch<PackageDetail>(`/packages/${packageId}`, body);
  },
  cancelPackage(packageId: string, reason: string) {
    return apiClient.post<PackageDetail>(`/packages/${packageId}/cancel`, {
      reason,
    });
  },
  receivePackage(packageId: string, body: Record<string, unknown>) {
    return apiClient.post<PackageReception>(`/packages/${packageId}/receive`, body);
  },
  getPackageReception(packageId: string) {
    return apiClient.get<PackageReception>(
      `/packages/${packageId}/reception`,
    );
  },
  listPackageDocuments(packageId: string) {
    return apiClient.get<PackageDocumentListResponse>(
      `/packages/${packageId}/documents`,
    );
  },
  createPackageDocumentUploadIntent(
    packageId: string,
    body: Record<string, unknown>,
  ) {
    return apiClient.post<PackageDocumentUploadIntentResponse>(
      `/packages/${packageId}/documents/upload-intent`,
      body,
    );
  },
  completePackageDocument(packageId: string, documentId: string) {
    return apiClient.post<PackageDocument>(
      `/packages/${packageId}/documents/${documentId}/complete`,
      {},
    );
  },
  deletePackageDocument(packageId: string, documentId: string) {
    return apiClient.delete<PackageDocument>(
      `/packages/${packageId}/documents/${documentId}`,
    );
  },
  listServices(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<CourierServiceListResponse>(
      `/services${buildQuery(params)}`,
    );
  },
  createService(body: Record<string, unknown>) {
    return apiClient.post<CourierService>("/services", body);
  },
  listRateCards(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<RateCardListResponse>(
      `/rate-cards${buildQuery(params)}`,
    );
  },
  createRateCard(body: Record<string, unknown>) {
    return apiClient.post<RateCard>("/rate-cards", body);
  },
  getRateCard(rateCardId: string) {
    return apiClient.get<RateCard>(`/rate-cards/${rateCardId}`);
  },
  replaceRateRules(rateCardId: string, body: Record<string, unknown>) {
    return apiClient.put<RateCard>(`/rate-cards/${rateCardId}/rules`, body);
  },
  activateRateCard(rateCardId: string) {
    return apiClient.post<RateCard>(`/rate-cards/${rateCardId}/activate`, {});
  },
  quoteRate(body: Record<string, unknown>) {
    return apiClient.post<RateQuote>("/rates/quote", body);
  },
  listCustomsCases(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<CustomsCaseListResponse>(`/customs-cases${buildQuery(params || {})}`);
  },
  createCustomsCase(data: CreateCustomsCaseDto) {
    return apiClient.post<CustomsCase>("/customs-cases", data as unknown as Record<string, unknown>);
  },
  getCustomsCase(id: string) {
    return apiClient.get<CustomsCase>(`/customs-cases/${id}`);
  },
  recordCustomsCaseEvent(id: string, data: RecordCustomsEventDto) {
    return apiClient.post<CustomsCaseEvent>(`/customs-cases/${id}/events`, data as unknown as Record<string, unknown>);
  },
  changeCustomsCaseStatus(id: string, data: ChangeCustomsCaseStatusDto) {
    return apiClient.post<any>(`/customs-cases/${id}/status`, data as unknown as Record<string, unknown>);
  },


  // Dispatches
  listDispatches(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<Dispatch[]>(`/dispatches${buildQuery(params || {})}`);
  },
  getDispatch(id: string) {
    return apiClient.get<Dispatch>(`/dispatches/${id}`);
  },
  createDispatch(data: CreateDispatchDto) {
    return apiClient.post<Dispatch>("/dispatches", data as unknown as Record<string, unknown>);
  },
  updateDispatch(id: string, data: UpdateDispatchDto) {
    return apiClient.patch<Dispatch>(`/dispatches/${id}`, data as unknown as Record<string, unknown>);
  },
  addPackagesToDispatch(id: string, data: AddPackagesToDispatchDto) {
    return apiClient.post<Dispatch>(`/dispatches/${id}/packages`, data as unknown as Record<string, unknown>);
  },
  removePackagesFromDispatch(id: string, data: AddPackagesToDispatchDto) {
    return apiClient.delete<Dispatch>(`/dispatches/${id}/packages`, data as unknown as Record<string, unknown>);
  },

  // Master Shipments
  listMasterShipments(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<MasterShipment[]>(`/master-shipments${buildQuery(params || {})}`);
  },
  getMasterShipment(id: string) {
    return apiClient.get<MasterShipment>(`/master-shipments/${id}`);
  },
  createMasterShipment(data: CreateMasterShipmentDto) {
    return apiClient.post<MasterShipment>("/master-shipments", data as unknown as Record<string, unknown>);
  },
  updateMasterShipment(id: string, data: UpdateMasterShipmentDto) {
    return apiClient.patch<MasterShipment>(`/master-shipments/${id}`, data as unknown as Record<string, unknown>);
  },
  updateMasterShipmentMawb(id: string, data: UpdateMawbDto) {
    return apiClient.patch<MasterShipment>(`/master-shipments/${id}/mawb`, data as unknown as Record<string, unknown>);
  },
  replaceMasterShipmentPackages(id: string, data: AddPackagesToMasterShipmentDto) {
    return apiClient.put<MasterShipment>(`/master-shipments/${id}/packages`, data as unknown as Record<string, unknown>);
  },
  addPackagesToMasterShipment(id: string, data: AddPackagesToMasterShipmentDto) {
    return apiClient.post<MasterShipment>(`/master-shipments/${id}/packages`, data as unknown as Record<string, unknown>);
  },
  removePackagesFromMasterShipment(id: string, data: AddPackagesToMasterShipmentDto) {
    return apiClient.delete<MasterShipment>(`/master-shipments/${id}/packages`, data as unknown as Record<string, unknown>);
  },
  closeMasterShipment(id: string) {
    return apiClient.post<MasterShipment>(`/master-shipments/${id}/close`, {});
  },
  departMasterShipment(id: string) {
    return apiClient.post<MasterShipment>(`/master-shipments/${id}/depart`, {});
  },
  arriveMasterShipment(id: string) {
    return apiClient.post<MasterShipment>(`/master-shipments/${id}/arrive`, {});
  },
  cancelMasterShipment(id: string) {
    return apiClient.post<MasterShipment>(`/master-shipments/${id}/cancel`, {});
  },

  // Holds
  listHolds(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<OperationalHold[]>(`/holds${buildQuery(params || {})}`);
  },
  getHold(id: string) {
    return apiClient.get<OperationalHold>(`/holds/${id}`);
  },
  createHold(data: CreateHoldDto) {
    return apiClient.post<OperationalHold>("/holds", data as unknown as Record<string, unknown>);
  },
  updateHold(id: string, data: UpdateHoldDto) {
    return apiClient.patch<OperationalHold>(`/holds/${id}`, data as unknown as Record<string, unknown>);
  },
  releaseHold(id: string, releaseReason: string) {
    return apiClient.post<OperationalHold>(`/holds/${id}/release`, {
      releaseReason,
    });
  },

  // Corrections
  listCorrections(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<CorrectionRequest[]>(`/corrections${buildQuery(params || {})}`);
  },
  getCorrection(id: string) {
    return apiClient.get<CorrectionRequest>(`/corrections/${id}`);
  },
  createCorrection(data: CreateCorrectionDto) {
    return apiClient.post<CorrectionRequest>("/corrections", data as unknown as Record<string, unknown>);
  },
  updateCorrection(id: string, data: UpdateCorrectionDto) {
    return apiClient.patch<CorrectionRequest>(`/corrections/${id}`, data as unknown as Record<string, unknown>);
  },
  approveCorrection(id: string, reason?: string) {
    return apiClient.post<CorrectionRequest>(`/corrections/${id}/approve`, {
      reason,
    });
  },
  rejectCorrection(id: string, reason?: string) {
    return apiClient.post<CorrectionRequest>(`/corrections/${id}/reject`, {
      reason,
    });
  },
  applyCorrection(id: string) {
    return apiClient.post<CorrectionRequest>(`/corrections/${id}/apply`, {});
  },

  // House Shipments
  listHouseShipments(shipmentId: string) {
    return apiClient.get<HouseShipment[]>(`/master-shipments/${shipmentId}/house-shipments`);
  },
  getHouseShipment(id: string) {
    return apiClient.get<HouseShipment>(`/house-shipments/${id}`);
  },
  createHouseShipment(shipmentId: string, data: CreateHouseShipmentDto) {
    return apiClient.post<HouseShipment>(`/master-shipments/${shipmentId}/house-shipments`, data as unknown as Record<string, unknown>);
  },
  updateHouseShipment(id: string, data: UpdateHouseShipmentDto) {
    return apiClient.patch<HouseShipment>(`/house-shipments/${id}`, data as unknown as Record<string, unknown>);
  },
  addPackagesToHouseShipment(id: string, data: AddPackagesToHouseShipmentDto) {
    return apiClient.put<any>(`/house-shipments/${id}/packages`, data as unknown as Record<string, unknown>);
  },
  closeHouseShipment(id: string) {
    return apiClient.post<any>(`/house-shipments/${id}/close`, {});
  },
  cancelHouseShipment(id: string) {
    return apiClient.post<any>(`/house-shipments/${id}/cancel`, {});
  },

  // Customs Manifests
  listCustomsManifests(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<CustomsManifest[]>(`/customs-manifests${buildQuery(params || {})}`);
  },
  getCustomsManifest(id: string) {
    return apiClient.get<CustomsManifest>(`/customs-manifests/${id}`);
  },
  createCustomsManifest(data: CreateCustomsManifestDto) {
    return apiClient.post<CustomsManifest>("/customs-manifests", data as unknown as Record<string, unknown>);
  },
  updateCustomsManifest(id: string, data: UpdateCustomsManifestDto) {
    return apiClient.patch<CustomsManifest>(`/customs-manifests/${id}`, data as unknown as Record<string, unknown>);
  },
  addPackagesToCustomsManifest(id: string, data: AddPackagesToCustomsManifestDto) {
    return apiClient.post<any>(`/customs-manifests/${id}/packages`, data as unknown as Record<string, unknown>);
  },
  removePackagesFromCustomsManifest(id: string, data: { packageIds: string[] }) {
    return apiClient.delete<any>(`/customs-manifests/${id}/packages`, data as unknown as Record<string, unknown>);
  },
  transmitCustomsManifest(id: string) {
    return apiClient.post<CustomsManifest>(`/customs-manifests/${id}/transmit`, {});
  },

  // Invoices
  listInvoices(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<{ items: InvoiceRecord[] }>(`/invoices${buildQuery(params || {})}`);
  },
  getInvoice(id: string) {
    return apiClient.get<InvoiceRecord>(`/invoices/${id}`);
  },
  createInvoice(data: CreateInvoiceDto) {
    return apiClient.post<InvoiceRecord>("/invoices", data as unknown as Record<string, unknown>);
  },
  updateInvoice(id: string, data: UpdateInvoiceDto) {
    return apiClient.patch<InvoiceRecord>(`/invoices/${id}`, data as unknown as Record<string, unknown>);
  },
  issueInvoice(id: string) {
    return apiClient.post<InvoiceRecord>(`/invoices/${id}/issue`, {});
  },
  voidInvoice(id: string, data: VoidReasonDto) {
    return apiClient.post<InvoiceRecord>(`/invoices/${id}/void`, data as unknown as Record<string, unknown>);
  },

  // Payments
  listPayments(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<{ items: PaymentRecord[] }>(`/payments${buildQuery(params || {})}`);
  },
  getPayment(id: string) {
    return apiClient.get<PaymentRecord>(`/payments/${id}`);
  },
  createPayment(data: CreatePaymentDto) {
    return apiClient.post<PaymentRecord>("/payments", data as unknown as Record<string, unknown>);
  },
  applyPayment(id: string, data: ApplyPaymentDto) {
    return apiClient.post<PaymentRecord>(`/payments/${id}/apply`, data as unknown as Record<string, unknown>);
  },
  voidPayment(id: string, data: VoidReasonDto) {
    return apiClient.post<PaymentRecord>(`/payments/${id}/void`, data as unknown as Record<string, unknown>);
  },

  // Pickups
  listPickupRequests() {
    return apiClient.get<PickupRequestRecord[]>("/pickup-requests");
  },
  getPickupRequest(id: string) {
    return apiClient.get<PickupRequestRecord>(`/pickup-requests/${id}`);
  },
  createPickupRequest(data: CreatePickupRequestDto) {
    return apiClient.post<PickupRequestRecord>("/pickup-requests", data as unknown as Record<string, unknown>);
  },
  updatePickupRequest(id: string, data: UpdatePickupRequestDto) {
    return apiClient.patch<PickupRequestRecord>(`/pickup-requests/${id}`, data as unknown as Record<string, unknown>);
  },
  markPickupRequestReady(id: string) {
    return apiClient.post<PickupRequestRecord>(`/pickup-requests/${id}/ready`, {});
  },
  completePickupRequest(id: string) {
    return apiClient.post<PickupRequestRecord>(`/pickup-requests/${id}/complete`, {});
  },
  cancelPickupRequest(id: string) {
    return apiClient.post<PickupRequestRecord>(`/pickup-requests/${id}/cancel`, {});
  },

  // Transfers
  listTransfers(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<{ items: FacilityTransfer[], pagination: any }>(`/transfers${buildQuery(params || {})}`);
  },
  getTransfer(id: string) {
    return apiClient.get<FacilityTransfer>(`/transfers/${id}`);
  },
  createTransfer(data: CreateTransferDto) {
    return apiClient.post<FacilityTransfer>("/transfers", data as unknown as Record<string, unknown>);
  },
  addTransferItems(id: string, data: AddTransferItemDto) {
    return apiClient.post<FacilityTransfer>(`/transfers/${id}/items`, data as unknown as Record<string, unknown>);
  },
  removeTransferItem(transferId: string, itemId: string) {
    return apiClient.delete<FacilityTransfer>(`/transfers/${transferId}/items/${itemId}`);
  },
  dispatchTransfer(id: string, data: DispatchTransferDto) {
    return apiClient.post<FacilityTransfer>(`/transfers/${id}/dispatch`, data as unknown as Record<string, unknown>);
  },
  receiveTransferItem(transferId: string, itemId: string, data: ReceiveTransferItemDto) {
    return apiClient.put<FacilityTransfer>(`/transfers/${transferId}/items/${itemId}/receive`, data as unknown as Record<string, unknown>);
  },

  // Deliveries
  listDeliveries(params?: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<any>(`/deliveries${buildQuery(params || {})}`);
  },
  getDelivery(id: string) {
    return apiClient.get<any>(`/deliveries/${id}`);
  },
  createDelivery(data: any) {
    return apiClient.post<any>("/deliveries", data);
  },
  updateDelivery(id: string, data: any) {
    return apiClient.patch<any>(`/deliveries/${id}`, data);
  },
  markDeliveryReady(id: string) {
    return apiClient.post<any>(`/deliveries/${id}/ready`, {});
  },
  dispatchDelivery(id: string) {
    return apiClient.post<any>(`/deliveries/${id}/dispatch`, {});
  },
  recordDeliveryAttempt(id: string, data: any) {
    return apiClient.post<any>(`/deliveries/${id}/attempts`, data);
  },
  cancelDelivery(id: string) {
    return apiClient.post<any>(`/deliveries/${id}/cancel`, {});
  },
};
