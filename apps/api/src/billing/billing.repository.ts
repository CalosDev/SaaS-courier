import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CustomerInvoice,
  InvoiceLine,
  Payment,
  PaymentAllocation,
  Prisma,
} from '../generated/prisma/client';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoice(
    data: Prisma.CustomerInvoiceCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerInvoice & { lines: InvoiceLine[] }> {
    const db = tx ?? this.prisma;
    return db.customerInvoice.create({
      data,
      include: { lines: true },
    });
  }

  async getInvoiceById(
    organizationId: string,
    invoiceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<
    | (CustomerInvoice & {
        lines: InvoiceLine[];
        allocations: PaymentAllocation[];
      })
    | null
  > {
    const db = tx ?? this.prisma;
    return db.customerInvoice.findUnique({
      where: {
        organizationId_id: { organizationId, id: invoiceId },
      },
      include: { lines: true, allocations: true },
    });
  }

  async updateInvoice(
    organizationId: string,
    invoiceId: string,
    data: Prisma.CustomerInvoiceUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerInvoice & { lines: InvoiceLine[] }> {
    const db = tx ?? this.prisma;
    return db.customerInvoice.update({
      where: {
        organizationId_id: { organizationId, id: invoiceId },
      },
      data,
      include: { lines: true },
    });
  }

  async findInvoicesByOrganization(
    organizationId: string,
  ): Promise<CustomerInvoice[]> {
    return this.prisma.customerInvoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPayment(
    data: Prisma.PaymentCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Payment> {
    const db = tx ?? this.prisma;
    return db.payment.create({ data });
  }

  async getPaymentById(
    organizationId: string,
    paymentId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<(Payment & { allocations: PaymentAllocation[] }) | null> {
    const db = tx ?? this.prisma;
    return db.payment.findUnique({
      where: { organizationId_id: { organizationId, id: paymentId } },
      include: { allocations: true },
    });
  }

  async updatePayment(
    organizationId: string,
    paymentId: string,
    data: Prisma.PaymentUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Payment> {
    const db = tx ?? this.prisma;
    return db.payment.update({
      where: { organizationId_id: { organizationId, id: paymentId } },
      data,
    });
  }

  async createPaymentAllocation(
    data: Prisma.PaymentAllocationCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentAllocation> {
    const db = tx ?? this.prisma;
    return db.paymentAllocation.create({ data });
  }

  async findPaymentsByOrganization(organizationId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
