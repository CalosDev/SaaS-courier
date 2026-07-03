"use client";

import { apiClient } from "@/lib/api/client";
import type {
  AuthorizationResponse,
  Customer,
  CustomerAddress,
  CustomerCustomsProfile,
  CustomerImportJob,
  CustomerListResponse,
  Employee,
  EmployeeInvitationResponse,
  EmployeeListResponse,
  Facility,
  FacilityListResponse,
  Onboarding,
  Organization,
  OrganizationCapabilities,
  OrganizationSettings,
  PermissionItem,
  PrealertDetail,
  PrealertListResponse,
  Role,
  RoleDetail,
  RoleListResponse,
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
  updatePrealert(prealertId: string, body: Record<string, unknown>) {
    return apiClient.patch<PrealertDetail>(`/prealerts/${prealertId}`, body);
  },
  cancelPrealert(prealertId: string, reason: string) {
    return apiClient.post<PrealertDetail>(`/prealerts/${prealertId}/cancel`, {
      reason,
    });
  },
};
