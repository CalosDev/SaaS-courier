import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { BillingRepository } from './billing.repository';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../audit/prisma-audit-outbox.writer', () => {
  return {
    PrismaAuditOutboxWriter: jest.fn().mockImplementation(() => ({
      write: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: jest.Mocked<BillingRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: BillingRepository,
          useValue: {
            createInvoice: jest.fn(),
            getInvoiceById: jest.fn(),
            findInvoicesByOrganization: jest.fn(),
            updateInvoice: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) =>
              cb({
                invoiceLine: { deleteMany: jest.fn().mockResolvedValue(true) },
                customer: {
                  findUnique: jest.fn().mockResolvedValue({ id: 'cust-1' }),
                },
                paymentAllocation: { updateMany: jest.fn() },
                payment: {
                  findUniqueOrThrow: jest.fn(),
                  update: jest.fn(),
                },
                $queryRaw: jest.fn(),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    repo = module.get(BillingRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('createInvoice should create and return mapped record', async () => {
    const mockDbInvoice = {
      id: 'inv-1',
      subtotalMinor: 100n,
      taxMinor: 0n,
      totalMinor: 100n,
      balanceDueMinor: 100n,
      lines: [],
    } as any;
    repo.createInvoice.mockResolvedValue(mockDbInvoice);

    const input = {
      customerId: 'cust-1',
      currencyCode: 'USD',
      lines: [
        {
          type: 'SHIPPING',
          description: 'desc',
          quantity: 1,
          unitPriceMinor: 100,
        },
      ],
    } as any;

    const res = await service.createInvoice('org-1', input, {} as any);
    expect(res.id).toBe('inv-1');
    expect(res.totalMinor).toBe('100');
    expect(repo.createInvoice).toHaveBeenCalled();
  });

  it('getInvoice should return invoice record', async () => {
    const mockDbInvoice = {
      id: 'inv-1',
      subtotalMinor: 100n,
      taxMinor: 0n,
      totalMinor: 100n,
      balanceDueMinor: 100n,
      lines: [],
    } as any;
    repo.getInvoiceById.mockResolvedValue(mockDbInvoice);
    const res = await service.getInvoice('org-1', 'inv-1');
    expect(res.id).toBe('inv-1');
  });

  it('listInvoices should return records', async () => {
    const mockDbInvoice = {
      id: 'inv-1',
      subtotalMinor: 100n,
      taxMinor: 0n,
      totalMinor: 100n,
      balanceDueMinor: 100n,
      lines: [
        {
          id: 'line-1',
          type: 'TRANSPORT',
          description: 'Shipping',
          quantity: 1,
          unitPriceMinor: 100n,
          totalPriceMinor: 100n,
        },
      ],
      allocations: [],
    } as any;
    repo.findInvoicesByOrganization.mockResolvedValue([mockDbInvoice]);
    const res = await service.listInvoices('org-1');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('inv-1');
  });

  it('issueInvoice should update status', async () => {
    const mockDbInvoice = {
      id: 'inv-1',
      status: 'DRAFT',
      subtotalMinor: 100n,
      taxMinor: 0n,
      totalMinor: 100n,
      balanceDueMinor: 100n,
      lines: [
        {
          id: 'line-1',
          type: 'TRANSPORT',
          description: 'Shipping',
          quantity: 1,
          unitPriceMinor: 100n,
          totalPriceMinor: 100n,
        },
      ],
      allocations: [],
    } as any;
    repo.getInvoiceById.mockResolvedValue(mockDbInvoice);
    const mockUpdatedInvoice = { ...mockDbInvoice, status: 'ISSUED' };
    repo.updateInvoice.mockResolvedValue(mockUpdatedInvoice);

    const res = await service.issueInvoice('org-1', 'inv-1', {} as any);
    expect(res.status).toBe('ISSUED');
  });

  it('voidInvoice should update status', async () => {
    const mockDbInvoice = {
      id: 'inv-1',
      status: 'ISSUED',
      subtotalMinor: 100n,
      taxMinor: 0n,
      totalMinor: 100n,
      balanceDueMinor: 100n,
      lines: [
        {
          id: 'line-1',
          type: 'TRANSPORT',
          description: 'Shipping',
          quantity: 1,
          unitPriceMinor: 100n,
          totalPriceMinor: 100n,
        },
      ],
      allocations: [],
    } as any;
    repo.getInvoiceById.mockResolvedValue(mockDbInvoice);
    const mockUpdatedInvoice = {
      ...mockDbInvoice,
      status: 'VOID',
      balanceDueMinor: 0n,
    };
    repo.updateInvoice.mockResolvedValue(mockUpdatedInvoice);

    const res = await service.voidInvoice(
      'org-1',
      'inv-1',
      { reason: 'mistake' },
      {} as any,
    );
    expect(res.status).toBe('VOID');
  });
});
