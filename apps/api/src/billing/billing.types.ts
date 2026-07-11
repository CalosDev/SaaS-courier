import {
  InvoiceLineType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/client';

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
  issuedAt: Date | null;
  dueDate: Date | null;
  voidedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: InvoiceLineRecord[];
}

export interface PaymentAllocationRecord {
  id: string;
  paymentId: string;
  invoiceId: string;
  amountMinor: string;
  appliedAt: Date;
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
  recordedAt: Date;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  allocations: PaymentAllocationRecord[];
}
