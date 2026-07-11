import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BillingRepository } from './billing.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ApplyPaymentDto } from './dto/apply-payment.dto';
import { VoidReasonDto } from './dto/void-reason.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { PaymentRecord } from './billing.types';
import type { Payment, PaymentAllocation } from '../generated/prisma/client';

@Injectable()
export class PaymentsService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createPayment(
    organizationId: string,
    input: CreatePaymentDto,
    context?: CommandContext,
  ): Promise<PaymentRecord> {
    const paymentNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return this.prisma.$transaction(async (tx) => {
      const dbPayment = await this.billingRepository.createPayment(
        {
          organization: { connect: { id: organizationId } },
          customer: { connect: { id: input.customerId } },
          paymentNumber,
          method: input.method,
          amountMinor: BigInt(input.amountMinor),
          currencyCode: input.currencyCode,
          reference: input.reference,
          status: 'RECORDED',
        },
        tx,
      );

      const record = this.toPaymentRecord({ ...dbPayment, allocations: [] });

      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'payment.recorded',
          entityType: 'PAYMENT',
          entityId: record.id,
          changedFields: ['paymentNumber', 'amountMinor', 'method'],
          afterData: {
            paymentNumber: record.paymentNumber,
            amountMinor: record.amountMinor,
            method: record.method,
          },
          payload: { paymentId: record.id },
        });
      }

      return record;
    });
  }

  async getPayment(
    organizationId: string,
    paymentId: string,
  ): Promise<PaymentRecord> {
    const payment = await this.billingRepository.getPaymentById(
      organizationId,
      paymentId,
    );
    if (!payment) throw new NotFoundException('Payment not found');
    return this.toPaymentRecord(payment);
  }

  async listPayments(organizationId: string): Promise<PaymentRecord[]> {
    const payments =
      await this.billingRepository.findPaymentsByOrganization(organizationId);
    return payments.map((p) => this.toPaymentRecord({ ...p, allocations: [] }));
  }

  async applyPayment(
    organizationId: string,
    paymentId: string,
    input: ApplyPaymentDto,
    context?: CommandContext,
  ): Promise<PaymentRecord> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.billingRepository.getPaymentById(
        organizationId,
        paymentId,
        tx,
      );
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === 'VOID')
        throw new BadRequestException('Voided payment cannot be applied');

      const invoice = await this.billingRepository.getInvoiceById(
        organizationId,
        input.invoiceId,
        tx,
      );
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === 'DRAFT' || invoice.status === 'VOID') {
        throw new BadRequestException(
          'Cannot apply payment to draft or voided invoice',
        );
      }

      const applyAmountMinor = BigInt(input.amountMinor);
      if (applyAmountMinor <= 0n) {
        throw new BadRequestException('Application amount must be positive');
      }
      if (applyAmountMinor > invoice.balanceDueMinor) {
        throw new BadRequestException(
          'Application amount exceeds invoice balance due',
        );
      }

      // Check available payment amount
      const alreadyApplied = payment.allocations.reduce(
        (sum: bigint, a: PaymentAllocation) => sum + a.amountMinor,
        0n,
      );
      const availableAmount = payment.amountMinor - alreadyApplied;
      if (applyAmountMinor > availableAmount) {
        throw new BadRequestException(
          'Application amount exceeds available payment amount',
        );
      }

      const allocation = await this.billingRepository.createPaymentAllocation(
        {
          organization: { connect: { id: organizationId } },
          payment: { connect: { id: paymentId } },
          invoice: { connect: { id: invoice.id } },
          amountMinor: applyAmountMinor,
        },
        tx,
      );

      // Update Invoice status and balance
      const newBalance = invoice.balanceDueMinor - applyAmountMinor;
      const newInvoiceStatus = newBalance === 0n ? 'PAID' : 'PARTIALLY_PAID';

      await this.billingRepository.updateInvoice(
        organizationId,
        invoice.id,
        {
          balanceDueMinor: newBalance,
          status: newInvoiceStatus,
        },
        tx,
      );

      // Update Payment status
      const paymentNowApplied = alreadyApplied + applyAmountMinor;
      const newPaymentStatus =
        paymentNowApplied === payment.amountMinor ? 'APPLIED' : 'RECORDED';

      const updatedPayment = await this.billingRepository.updatePayment(
        organizationId,
        payment.id,
        {
          status: newPaymentStatus,
        },
        tx,
      );

      const record = this.toPaymentRecord({
        ...updatedPayment,
        allocations: [...payment.allocations, allocation],
      });

      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'payment.applied',
          entityType: 'PAYMENT',
          entityId: record.id,
          changedFields: ['invoiceId', 'amountMinor', 'paymentStatus'],
          afterData: {
            invoiceId: invoice.id,
            amountMinor: applyAmountMinor.toString(),
            paymentStatus: record.status,
          },
          payload: { paymentId: record.id, invoiceId: invoice.id },
        });
      }

      return record;
    });
  }

  async voidPayment(
    organizationId: string,
    paymentId: string,
    input: VoidReasonDto,
    context?: CommandContext,
  ): Promise<PaymentRecord> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.billingRepository.getPaymentById(
        organizationId,
        paymentId,
        tx,
      );
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === 'VOID')
        throw new BadRequestException('Payment is already voided');

      // We need to un-apply all allocations
      for (const allocation of payment.allocations) {
        const invoice = await this.billingRepository.getInvoiceById(
          organizationId,
          allocation.invoiceId,
          tx,
        );
        if (invoice) {
          const newBalance = invoice.balanceDueMinor + allocation.amountMinor;
          const newStatus =
            newBalance === invoice.totalMinor ? 'ISSUED' : 'PARTIALLY_PAID'; // Assumes ISSUED if full amount due
          await this.billingRepository.updateInvoice(
            organizationId,
            invoice.id,
            {
              balanceDueMinor: newBalance,
              status: invoice.status === 'VOID' ? 'VOID' : newStatus, // don't resurrect voided invoices
            },
            tx,
          );
        }
        await tx.paymentAllocation.delete({
          where: { organizationId_id: { organizationId, id: allocation.id } },
        });
      }

      const updated = await this.billingRepository.updatePayment(
        organizationId,
        paymentId,
        { status: 'VOID', voidedAt: new Date() },
        tx,
      );

      const record = this.toPaymentRecord({ ...updated, allocations: [] });

      if (context) {
        await this.auditWriter.write(tx, {
          context,
          action: 'payment.voided',
          entityType: 'PAYMENT',
          entityId: record.id,
          changedFields: ['status', 'voidReason'],
          afterData: { status: record.status, voidReason: input.reason },
          payload: { paymentId: record.id },
        });
      }

      return record;
    });
  }

  private toPaymentRecord(
    payment: Payment & { allocations?: PaymentAllocation[] },
  ): PaymentRecord {
    return {
      id: payment.id,
      customerId: payment.customerId,
      paymentNumber: payment.paymentNumber,
      method: payment.method,
      amountMinor: payment.amountMinor.toString(),
      currencyCode: payment.currencyCode,
      reference: payment.reference,
      status: payment.status,
      recordedAt: payment.recordedAt,
      voidedAt: payment.voidedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      allocations: (payment.allocations || []).map((a) => ({
        id: a.id,
        paymentId: a.paymentId,
        invoiceId: a.invoiceId,
        amountMinor: a.amountMinor.toString(),
        appliedAt: a.appliedAt,
      })),
    };
  }
}
