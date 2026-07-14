import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { InvoicesService } from '../src/billing/invoices.service';
import { PaymentsService } from '../src/billing/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Billing concurrency integration', () => {
  it('prevents over-application and preserves reversed allocation evidence', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const organizationIds: string[] = [];
    const userIds: string[] = [];
    const employeeIds: string[] = [];
    const customerIds: string[] = [];

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;
      process.env.NODE_ENV = 'test';
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const invoices = moduleRef.get(InvoicesService);
      const payments = moduleRef.get(PaymentsService);
      const suffix = randomUUID();
      const organization = await prisma.organization.create({
        data: {
          legalName: `Billing ${suffix}`,
          commercialName: `Billing ${suffix}`,
          slug: `billing-${suffix}`,
          status: 'ACTIVE',
        },
      });
      organizationIds.push(organization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: organization.id },
      });
      const user = await prisma.user.create({
        data: { email: `billing.${suffix}@courier.test`, status: 'ACTIVE' },
      });
      userIds.push(user.id);
      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          firstName: 'Billing',
          lastName: 'Operator',
          status: 'ACTIVE',
        },
      });
      employeeIds.push(employee.id);
      const customer = await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerCode: `BL${suffix.slice(0, 8).toUpperCase()}`,
          type: 'INDIVIDUAL',
          firstName: 'Billing',
          lastName: 'Customer',
          status: 'ACTIVE',
        },
      });
      customerIds.push(customer.id);
      const context = buildContext(organization.id, employee.id, user.id);

      const draft = await invoices.createInvoice(
        organization.id,
        {
          customerId: customer.id,
          currencyCode: 'DOP',
          lines: [
            {
              type: 'TRANSPORT',
              description: 'International transport',
              quantity: 1,
              unitPriceMinor: '10000',
            },
          ],
        },
        context,
      );
      await invoices.issueInvoice(organization.id, draft.id, context);
      const [paymentOne, paymentTwo] = await Promise.all([
        payments.createPayment(
          organization.id,
          {
            customerId: customer.id,
            method: 'CASH',
            amountMinor: '7000',
            currencyCode: 'DOP',
          },
          context,
        ),
        payments.createPayment(
          organization.id,
          {
            customerId: customer.id,
            method: 'BANK_TRANSFER',
            amountMinor: '7000',
            currencyCode: 'DOP',
          },
          context,
        ),
      ]);

      const attempts = await Promise.allSettled([
        payments.applyPayment(
          organization.id,
          paymentOne.id,
          { invoiceId: draft.id, amountMinor: '7000' },
          context,
        ),
        payments.applyPayment(
          organization.id,
          paymentTwo.id,
          { invoiceId: draft.id, amountMinor: '7000' },
          context,
        ),
      ]);
      expect(
        attempts.filter((attempt) => attempt.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.filter((attempt) => attempt.status === 'rejected'),
      ).toHaveLength(1);

      const appliedPayment =
        attempts[0].status === 'fulfilled' ? paymentOne : paymentTwo;
      const partiallyPaid = await prisma.customerInvoice.findUniqueOrThrow({
        where: {
          organizationId_id: { organizationId: organization.id, id: draft.id },
        },
      });
      expect(partiallyPaid).toMatchObject({
        status: 'PARTIALLY_PAID',
        balanceDueMinor: 3000n,
      });
      expect(
        await prisma.paymentAllocation.count({
          where: {
            organizationId: organization.id,
            invoiceId: draft.id,
            reversedAt: null,
          },
        }),
      ).toBe(1);

      await payments.voidPayment(
        organization.id,
        appliedPayment.id,
        { reason: 'Payment reversed by operator' },
        context,
      );
      const restored = await prisma.customerInvoice.findUniqueOrThrow({
        where: {
          organizationId_id: { organizationId: organization.id, id: draft.id },
        },
      });
      expect(restored).toMatchObject({
        status: 'ISSUED',
        balanceDueMinor: 10000n,
      });
      expect(
        await prisma.paymentAllocation.count({
          where: {
            organizationId: organization.id,
            paymentId: appliedPayment.id,
            reversedAt: { not: null },
            reversalReason: 'Payment reversed by operator',
          },
        }),
      ).toBe(1);

      const reusablePayment =
        appliedPayment.id === paymentOne.id ? paymentTwo : paymentOne;
      await payments.applyPayment(
        organization.id,
        reusablePayment.id,
        { invoiceId: draft.id, amountMinor: '3000' },
        context,
      );
      await invoices.voidInvoice(
        organization.id,
        draft.id,
        { reason: 'Invoice cancelled by operator' },
        context,
      );
      expect(
        await prisma.customerInvoice.findUniqueOrThrow({
          where: {
            organizationId_id: {
              organizationId: organization.id,
              id: draft.id,
            },
          },
        }),
      ).toMatchObject({
        status: 'VOID',
        balanceDueMinor: 0n,
        voidReason: 'Invoice cancelled by operator',
      });
      expect(
        await prisma.payment.findUniqueOrThrow({
          where: {
            organizationId_id: {
              organizationId: organization.id,
              id: reusablePayment.id,
            },
          },
        }),
      ).toMatchObject({ status: 'RECORDED' });
      expect(
        await prisma.paymentAllocation.count({
          where: {
            organizationId: organization.id,
            invoiceId: draft.id,
            reversedAt: { not: null },
          },
        }),
      ).toBe(2);
    } finally {
      if (prismaService) {
        await prismaService.paymentAllocation.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.payment.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.invoiceLine.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.customerInvoice.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await deleteAuditArtifactsForOrganizations(
          prismaService,
          organizationIds,
        );
        await prismaService.customer.deleteMany({
          where: { id: { in: customerIds } },
        });
        await prismaService.employee.deleteMany({
          where: { id: { in: employeeIds } },
        });
        await prismaService.user.deleteMany({ where: { id: { in: userIds } } });
        await prismaService.organizationSettings.deleteMany({
          where: { organizationId: { in: organizationIds } },
        });
        await prismaService.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      await app?.close();
      await moduleRef?.close();
    }
  }, 120_000);
});

function buildContext(
  organizationId: string,
  employeeId: string,
  userId: string,
): CommandContext {
  return {
    organizationId,
    actorType: 'EMPLOYEE',
    actorUserId: userId,
    actorEmployeeId: employeeId,
    source: 'HTTP',
    requestId: randomUUID(),
    correlationId: randomUUID(),
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
}
