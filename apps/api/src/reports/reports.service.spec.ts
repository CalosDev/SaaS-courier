import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { escapeCsvCell, ReportsService } from './reports.service';

describe('ReportsService', () => {
  const prisma = {
    package: { count: jest.fn(), groupBy: jest.fn() },
    prealert: { count: jest.fn() },
    houseShipment: { count: jest.fn() },
    packageInventoryPosition: { count: jest.fn() },
    inventoryMovement: { groupBy: jest.fn() },
    customerInvoice: { groupBy: jest.fn() },
    dispatch: { groupBy: jest.fn() },
    customsCase: { groupBy: jest.fn() },
  };
  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(prisma as unknown as PrismaService);
  });

  it('returns tenant-scoped dashboard metrics', async () => {
    prisma.package.count.mockResolvedValue(12);
    prisma.prealert.count.mockResolvedValue(5);
    prisma.houseShipment.count.mockResolvedValue(3);

    await expect(service.getDashboardMetrics('org-1')).resolves.toEqual({
      pendingPackages: 12,
      unmatchedPrealerts: 5,
      activeShipments: 3,
    });
    expect(prisma.package.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('applies tenant and bounded date filters to operations', async () => {
    prisma.package.groupBy.mockResolvedValue([
      { status: 'IN_TRANSIT', _count: { _all: 2 } },
    ]);

    const result = await service.getOperationsReport('org-2', {
      dateFrom: '2026-07-01T00:00:00.000Z',
      dateTo: '2026-07-31T23:59:59.000Z',
    });

    expect(result.data).toEqual({
      total: 2,
      byStatus: [{ status: 'IN_TRANSIT', count: 2 }],
    });
    expect(prisma.package.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-2',
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-31T23:59:59.000Z'),
          },
        },
      }),
    );
  });

  it('rejects reversed and oversized report ranges', async () => {
    await expect(
      service.getOperationsReport('org-1', {
        dateFrom: '2026-07-02T00:00:00.000Z',
        dateTo: '2026-07-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.getOperationsReport('org-1', {
        dateFrom: '2026-01-01T00:00:00.000Z',
        dateTo: '2026-07-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('cannot exceed 93 days');
  });
});

describe('escapeCsvCell', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd'])(
    'neutralizes formula-like value %s',
    (value) => {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    },
  );

  it('escapes quotes according to CSV rules', () => {
    expect(escapeCsvCell('A "quoted" value')).toBe('"A ""quoted"" value"');
  });
});
