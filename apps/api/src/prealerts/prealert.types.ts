import type { CommandContext } from '../request-context/request-context.types';
import type { PackageStatus } from '../generated/prisma/client';

export const PREALERT_STATUS_VALUES = [
  'PENDING_ARRIVAL',
  'MATCHED',
  'CANCELLED',
] as const;
export const PREALERT_INVOICE_STATUS_VALUES = [
  'NOT_REQUIRED',
  'PENDING',
  'PROVIDED',
  'REJECTED',
  'VERIFIED',
] as const;

export type PrealertStatus = (typeof PREALERT_STATUS_VALUES)[number];
export type PrealertInvoiceStatus =
  (typeof PREALERT_INVOICE_STATUS_VALUES)[number];

export interface PrealertCustomerSummary {
  id: string;
  customerCode: string;
  type: 'INDIVIDUAL' | 'BUSINESS';
  displayName: string;
}

export interface PrealertEmployeeSummary {
  id: string;
  displayName: string;
}

export interface PrealertMatchedPackageSummary {
  id: string;
  internalTrackingNumber: string;
  status: PackageStatus;
}

export interface PrealertRecord {
  id: string;
  prealertCode: string;
  customerId: string;
  externalTrackingNumber: string;
  carrierName: string | null;
  storeName: string;
  purchaseDate: Date | null;
  description: string;
  quantity: number;
  declaredValue: string;
  currencyCode: string;
  invoiceStatus: PrealertInvoiceStatus;
  status: PrealertStatus;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  customer: PrealertCustomerSummary;
  matchedPackage: PrealertMatchedPackageSummary | null;
  createdBy: PrealertEmployeeSummary;
  cancelledBy: PrealertEmployeeSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrealertInput {
  customerId: string;
  externalTrackingNumber: string;
  carrierName?: string;
  storeName: string;
  purchaseDate?: string;
  description: string;
  quantity: number;
  declaredValue: string | number;
  currencyCode?: string;
  invoiceStatus?: PrealertInvoiceStatus;
  notes?: string;
}

export interface CreatePrealertRecord {
  organizationId: string;
  customerId: string;
  createdByEmployeeId: string;
  externalTrackingNumber: string;
  externalTrackingNumberNormalized: string;
  carrierName: string | null;
  storeName: string;
  purchaseDate: Date | null;
  description: string;
  quantity: number;
  declaredValue: string;
  currencyCode: string;
  invoiceStatus: PrealertInvoiceStatus;
  status: PrealertStatus;
  notes: string | null;
}

export interface UpdatePrealertInput {
  customerId?: string;
  externalTrackingNumber?: string;
  carrierName?: string;
  storeName?: string;
  purchaseDate?: string | null;
  description?: string;
  quantity?: number;
  declaredValue?: string | number;
  currencyCode?: string;
  invoiceStatus?: PrealertInvoiceStatus;
  notes?: string | null;
}

export interface UpdatePrealertRecord {
  organizationId: string;
  prealertId: string;
  customerId?: string;
  externalTrackingNumber?: string;
  externalTrackingNumberNormalized?: string;
  carrierName?: string | null;
  storeName?: string;
  purchaseDate?: Date | null;
  description?: string;
  quantity?: number;
  declaredValue?: string;
  currencyCode?: string;
  invoiceStatus?: PrealertInvoiceStatus;
  notes?: string | null;
}

export interface CancelPrealertInput {
  reason: string;
}

export interface ListPrealertsInput {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: PrealertStatus;
  invoiceStatus?: PrealertInvoiceStatus;
  customerId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface ListPrealertsRecord {
  organizationId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: PrealertStatus;
  invoiceStatus?: PrealertInvoiceStatus;
  customerId?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface PrealertListResult {
  items: PrealertRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PrealertRepositoryContext {
  context?: CommandContext;
}
