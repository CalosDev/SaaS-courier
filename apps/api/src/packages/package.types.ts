import type { CommandContext } from '../request-context/request-context.types';

export const PACKAGE_STATUS_VALUES = [
  'RECEPTION_PENDING',
  'CANCELLED',
] as const;
export const PACKAGE_SOURCE_VALUES = ['MANUAL', 'PREALERT'] as const;

export type PackageStatus = (typeof PACKAGE_STATUS_VALUES)[number];
export type PackageSource = (typeof PACKAGE_SOURCE_VALUES)[number];

export interface PackageCustomerSummary {
  id: string;
  customerCode: string;
  type: 'INDIVIDUAL' | 'BUSINESS';
  displayName: string;
}

export interface PackagePrealertSummary {
  id: string;
  prealertCode: string;
  storeName: string;
}

export interface PackageEmployeeSummary {
  id: string;
  displayName: string;
}

export interface PackageRecord {
  id: string;
  internalTrackingNumber: string;
  externalTrackingNumber: string;
  status: PackageStatus;
  source: PackageSource;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  customer: PackageCustomerSummary;
  prealert: PackagePrealertSummary | null;
  registeredBy: PackageEmployeeSummary;
  cancelledBy: PackageEmployeeSummary | null;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePackageInput {
  prealertId?: string;
  customerId?: string;
  externalTrackingNumber?: string;
  notes?: string;
}

export interface CreateManualPackageRecord {
  organizationId: string;
  customerId: string;
  registeredByEmployeeId: string;
  externalTrackingNumber: string;
  externalTrackingNumberNormalized: string;
  notes: string | null;
}

export interface CreatePackageFromPrealertRecord {
  organizationId: string;
  prealertId: string;
  registeredByEmployeeId: string;
  notes: string | null;
}

export interface UpdatePackageInput {
  customerId?: string;
  externalTrackingNumber?: string;
  notes?: string | null;
}

export interface UpdatePackageRecord {
  organizationId: string;
  packageId: string;
  customerId?: string;
  externalTrackingNumber?: string;
  externalTrackingNumberNormalized?: string;
  notes?: string | null;
}

export interface CancelPackageInput {
  reason: string;
}

export interface ListPackagesInput {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: PackageStatus;
  customerId?: string;
  prealertId?: string;
  source?: PackageSource;
  registeredFrom?: string;
  registeredTo?: string;
}

export interface ListPackagesRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: PackageStatus;
  customerId?: string;
  prealertId?: string;
  source?: PackageSource;
  registeredFrom?: Date;
  registeredTo?: Date;
}

export interface PackageListResult {
  items: PackageRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PackageMatchedSummary {
  id: string;
  internalTrackingNumber: string;
  status: PackageStatus;
}

export interface PackageRepositoryContext {
  context?: CommandContext;
}
