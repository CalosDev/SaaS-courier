import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { BillingRepository } from './billing.repository';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../audit/prisma-audit-outbox.writer', () => {
  return {
    PrismaAuditOutboxWriter: jest.fn().mockImplementation(() => ({
      write: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repo: jest.Mocked<BillingRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: BillingRepository,
          useValue: {
            createPayment: jest.fn(),
            getPaymentById: jest.fn(),
            findPaymentsByOrganization: jest.fn(),
            updatePayment: jest.fn(),
            getInvoiceById: jest.fn(),
            createPaymentAllocation: jest.fn(),
            updateInvoice: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) =>
              cb({
                paymentAllocation: {
                  delete: jest.fn().mockResolvedValue(true),
                },
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    repo = module.get(BillingRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('createPayment should create and return mapped record', async () => {
    const mockDbPayment = {
      id: 'pay-1',
      amountMinor: 100n,
      allocations: [],
    } as any;
    repo.createPayment.mockResolvedValue(mockDbPayment);

    const input = {
      customerId: 'cust-1',
      currencyCode: 'USD',
      amountMinor: 100,
      method: 'CASH',
    } as any;

    const res = await service.createPayment('org-1', input, {} as any);
    expect(res.id).toBe('pay-1');
    expect(res.amountMinor).toBe('100');
    expect(repo.createPayment).toHaveBeenCalled();
  });

  it('getPayment should return payment record', async () => {
    const mockDbPayment = {
      id: 'pay-1',
      amountMinor: 100n,
      allocations: [],
    } as any;
    repo.getPaymentById.mockResolvedValue(mockDbPayment);
    const res = await service.getPayment('org-1', 'pay-1');
    expect(res.id).toBe('pay-1');
  });

  it('listPayments should return records', async () => {
    const mockDbPayment = {
      id: 'pay-1',
      amountMinor: 100n,
    } as any;
    repo.findPaymentsByOrganization.mockResolvedValue([mockDbPayment]);
    const res = await service.listPayments('org-1');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('pay-1');
  });

  it('applyPayment should allocate and update status', async () => {
    const mockDbPayment = {
      id: 'pay-1',
      status: 'RECORDED',
      amountMinor: 100n,
      allocations: [],
    } as any;
    repo.getPaymentById.mockResolvedValue(mockDbPayment);

    const mockInvoice = {
      id: 'inv-1',
      status: 'ISSUED',
      balanceDueMinor: 100n,
    } as any;
    repo.getInvoiceById.mockResolvedValue(mockInvoice);

    const mockAllocation = { id: 'alloc-1', amountMinor: 100n } as any;
    repo.createPaymentAllocation.mockResolvedValue(mockAllocation);

    const mockUpdatedPayment = {
      ...mockDbPayment,
      status: 'APPLIED',
      allocations: [mockAllocation],
    };
    repo.updatePayment.mockResolvedValue(mockUpdatedPayment);

    const res = await service.applyPayment(
      'org-1',
      'pay-1',
      { invoiceId: 'inv-1', amountMinor: '100' },
      {} as any,
    );
    expect(res.status).toBe('APPLIED');
  });

  it('voidPayment should void and un-apply', async () => {
    const mockAllocation = {
      id: 'alloc-1',
      amountMinor: 100n,
      invoiceId: 'inv-1',
    } as any;
    const mockDbPayment = {
      id: 'pay-1',
      status: 'APPLIED',
      amountMinor: 100n,
      allocations: [mockAllocation],
    } as any;
    repo.getPaymentById.mockResolvedValue(mockDbPayment);

    const mockInvoice = {
      id: 'inv-1',
      status: 'PAID',
      balanceDueMinor: 0n,
      totalMinor: 100n,
    } as any;
    repo.getInvoiceById.mockResolvedValue(mockInvoice);

    const mockUpdatedPayment = { ...mockDbPayment, status: 'VOID' };
    repo.updatePayment.mockResolvedValue(mockUpdatedPayment);

    const res = await service.voidPayment(
      'org-1',
      'pay-1',
      { reason: 'mistake' },
      {} as any,
    );
    expect(res.status).toBe('VOID');
    expect(repo.updateInvoice).toHaveBeenCalledWith(
      'org-1',
      'inv-1',
      { balanceDueMinor: 100n, status: 'ISSUED' },
      expect.anything(),
    );
  });
});
