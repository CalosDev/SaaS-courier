import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BillingRepository } from './billing.repository';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { VoidReasonDto } from './dto/void-reason.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { InvoiceRecord } from './billing.types';
import type {
  Prisma,
  CustomerInvoice,
  InvoiceLine,
} from '../generated/prisma/client';

@Injectable()
export class InvoicesService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createInvoice(
    organizationId: string,
    input: CreateInvoiceDto,
    context?: CommandContext,
  ): Promise<InvoiceRecord> {
    const subtotalMinor = input.lines.reduce(
      (sum, line) => sum + BigInt(line.unitPriceMinor) * BigInt(line.quantity),
      0n,
    );
    const taxMinor = 0n; // Assume 0 tax for now
    const totalMinor = subtotalMinor + taxMinor;
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: {
          organizationId_id: {
            organizationId,
            id: input.customerId,
          },
        },
        select: { id: true },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      const dbInvoice = await this.billingRepository.createInvoice(
        {
          organization: { connect: { id: organizationId } },
          customer: {
            connect: {
              organizationId_id: { organizationId, id: input.customerId },
            },
          },
          invoiceNumber,
          currencyCode: input.currencyCode,
          subtotalMinor,
          taxMinor,
          totalMinor,
          balanceDueMinor: totalMinor,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          notes: input.notes,
          status: 'DRAFT',
          lines: {
            create: input.lines.map((line) => ({
              organization: { connect: { id: organizationId } },
              type: line.type,
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: BigInt(line.unitPriceMinor),
              totalPriceMinor:
                BigInt(line.unitPriceMinor) * BigInt(line.quantity),
            })),
          },
        },
        tx,
      );

      const record = this.toInvoiceRecord(dbInvoice);

      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'invoice.created',
          entityType: 'INVOICE',
          entityId: record.id,
          changedFields: ['invoiceNumber', 'status', 'totalMinor'],
          afterData: {
            invoiceNumber: record.invoiceNumber,
            status: record.status,
            totalMinor: record.totalMinor,
          },
          payload: { invoiceId: record.id },
        });
      }

      return record;
    });
  }

  async getInvoice(
    organizationId: string,
    invoiceId: string,
  ): Promise<InvoiceRecord> {
    const invoice = await this.billingRepository.getInvoiceById(
      organizationId,
      invoiceId,
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.toInvoiceRecord(invoice);
  }

  async listInvoices(organizationId: string): Promise<InvoiceRecord[]> {
    const invoices =
      await this.billingRepository.findInvoicesByOrganization(organizationId);
    return invoices.map((i) => this.toInvoiceRecord({ ...i, lines: [] }));
  }

  async updateInvoice(
    organizationId: string,
    invoiceId: string,
    input: UpdateInvoiceDto,
    context?: CommandContext,
  ): Promise<InvoiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.billingRepository.getInvoiceById(
        organizationId,
        invoiceId,
        tx,
      );
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'DRAFT') {
        throw new BadRequestException('Only draft invoices can be updated');
      }

      let dataToUpdate: Prisma.CustomerInvoiceUpdateInput = {
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        notes: input.notes,
      };

      if (input.lines) {
        await tx.invoiceLine.deleteMany({
          where: { organizationId, invoiceId },
        });

        const subtotalMinor = input.lines.reduce(
          (sum, line) =>
            sum + BigInt(line.unitPriceMinor) * BigInt(line.quantity),
          0n,
        );
        const taxMinor = 0n;
        const totalMinor = subtotalMinor + taxMinor;

        dataToUpdate = {
          ...dataToUpdate,
          subtotalMinor,
          taxMinor,
          totalMinor,
          balanceDueMinor: totalMinor,
          lines: {
            create: input.lines.map((line) => ({
              organization: { connect: { id: organizationId } },
              type: line.type,
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: BigInt(line.unitPriceMinor),
              totalPriceMinor:
                BigInt(line.unitPriceMinor) * BigInt(line.quantity),
            })),
          },
        };
      }

      const updated = await this.billingRepository.updateInvoice(
        organizationId,
        invoiceId,
        dataToUpdate,
        tx,
      );
      const record = this.toInvoiceRecord(updated);

      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'invoice.updated',
          entityType: 'INVOICE',
          entityId: record.id,
          changedFields: ['status', 'totalMinor'],
          afterData: { status: record.status, totalMinor: record.totalMinor },
          payload: { invoiceId: record.id },
        });
      }
      return record;
    });
  }

  async issueInvoice(
    organizationId: string,
    invoiceId: string,
    context?: CommandContext,
  ): Promise<InvoiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.billingRepository.getInvoiceById(
        organizationId,
        invoiceId,
        tx,
      );
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'DRAFT')
        throw new BadRequestException('Only DRAFT invoices can be issued');
      if (invoice.lines.length === 0 || invoice.totalMinor <= 0n) {
        throw new BadRequestException(
          'Invoice must contain a positive total before issue',
        );
      }

      const updated = await this.billingRepository.updateInvoice(
        organizationId,
        invoiceId,
        { status: 'ISSUED', issuedAt: new Date() },
        tx,
      );

      const record = this.toInvoiceRecord(updated);

      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'invoice.issued',
          entityType: 'INVOICE',
          entityId: record.id,
          changedFields: ['status'],
          afterData: { status: record.status },
          payload: { invoiceId: record.id },
        });
      }

      return record;
    });
  }

  async voidInvoice(
    organizationId: string,
    invoiceId: string,
    input: VoidReasonDto,
    context?: CommandContext,
  ): Promise<InvoiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.billingRepository.getInvoiceById(
        organizationId,
        invoiceId,
        tx,
      );
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === 'PAID')
        throw new BadRequestException(
          'Paid invoices cannot be voided directly',
        );
      if (invoice.status === 'VOID')
        throw new BadRequestException('Invoice is already voided');

      const activeAllocations = invoice.allocations.filter(
        (allocation) => allocation.reversedAt === null,
      );
      const paymentIds = [
        ...new Set(activeAllocations.map((allocation) => allocation.paymentId)),
      ].sort();
      for (const paymentId of paymentIds) {
        await tx.$queryRaw`
          SELECT "id" FROM "payments"
          WHERE "organization_id" = ${organizationId}::uuid
            AND "id" = ${paymentId}::uuid
          FOR UPDATE
        `;
      }
      if (activeAllocations.length > 0) {
        await tx.paymentAllocation.updateMany({
          where: {
            organizationId,
            invoiceId,
            reversedAt: null,
          },
          data: { reversedAt: new Date(), reversalReason: input.reason },
        });
      }
      for (const paymentId of paymentIds) {
        const payment = await tx.payment.findUniqueOrThrow({
          where: {
            organizationId_id: { organizationId, id: paymentId },
          },
          include: { allocations: true },
        });
        const applied = payment.allocations
          .filter((allocation) => allocation.reversedAt === null)
          .reduce((sum, allocation) => sum + allocation.amountMinor, 0n);
        await tx.payment.update({
          where: {
            organizationId_id: { organizationId, id: paymentId },
          },
          data: {
            status: applied === payment.amountMinor ? 'APPLIED' : 'RECORDED',
          },
        });
      }

      const updated = await this.billingRepository.updateInvoice(
        organizationId,
        invoiceId,
        {
          status: 'VOID',
          voidedAt: new Date(),
          voidReason: input.reason,
          balanceDueMinor: 0n,
        },
        tx,
      );

      const record = this.toInvoiceRecord(updated);

      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'invoice.voided',
          entityType: 'INVOICE',
          entityId: record.id,
          changedFields: ['status', 'voidReason'],
          afterData: { status: record.status, voidReason: input.reason },
          payload: { invoiceId: record.id },
        });
      }

      return record;
    });
  }

  private toInvoiceRecord(
    invoice: CustomerInvoice & { lines?: InvoiceLine[] },
  ): InvoiceRecord {
    return {
      id: invoice.id,
      customerId: invoice.customerId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currencyCode: invoice.currencyCode,
      subtotalMinor: invoice.subtotalMinor.toString(),
      taxMinor: invoice.taxMinor.toString(),
      totalMinor: invoice.totalMinor.toString(),
      balanceDueMinor: invoice.balanceDueMinor.toString(),
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      voidedAt: invoice.voidedAt,
      voidReason: invoice.voidReason,
      notes: invoice.notes,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      lines: (invoice.lines || []).map((l) => ({
        id: l.id,
        type: l.type,
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor.toString(),
        totalPriceMinor: l.totalPriceMinor.toString(),
      })),
    };
  }
}
