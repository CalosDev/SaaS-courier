import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      package: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      prealert: {
        count: jest.fn(),
      },
      houseShipment: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should return aggregated dashboard metrics', async () => {
      prisma.package.count.mockResolvedValue(12);
      prisma.prealert.count.mockResolvedValue(5);
      prisma.houseShipment.count.mockResolvedValue(3);

      const result = await service.getDashboardMetrics('org-1');

      expect(result).toEqual({
        pendingPackages: 12,
        unmatchedPrealerts: 5,
        activeShipments: 3,
      });
    });

    it('should pass organizationId to all queries', async () => {
      prisma.package.count.mockResolvedValue(0);
      prisma.prealert.count.mockResolvedValue(0);
      prisma.houseShipment.count.mockResolvedValue(0);

      await service.getDashboardMetrics('org-abc');

      expect(prisma.package.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-abc' }),
        }),
      );
      expect(prisma.prealert.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-abc' }),
        }),
      );
      expect(prisma.houseShipment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-abc' }),
        }),
      );
    });
  });

  describe('getPackagesExportCsv', () => {
    it('should return a CSV string with headers', async () => {
      prisma.package.findMany.mockResolvedValue([]);
      const csv = await service.getPackagesExportCsv('org-1');
      expect(csv).toContain('ID');
      expect(csv).toContain('Tracking Interno');
      expect(csv).toContain('Estado');
    });

    it('should include package data in CSV rows', async () => {
      prisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          internalTrackingNumber: 'INT-001',
          externalTrackingNumber: 'EXT-999',
          customer: { firstName: 'Ana', lastName: 'Pérez' },
          status: 'IN_TRANSIT',
          createdAt: new Date('2026-01-15T12:00:00Z'),
        },
      ]);

      const csv = await service.getPackagesExportCsv('org-1');

      expect(csv).toContain('pkg-1');
      expect(csv).toContain('INT-001');
      expect(csv).toContain('EXT-999');
      expect(csv).toContain('Ana Pérez');
      expect(csv).toContain('IN_TRANSIT');
    });

    it('should handle packages without customer gracefully', async () => {
      prisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-2',
          internalTrackingNumber: 'INT-002',
          externalTrackingNumber: null,
          customer: null,
          status: 'RECEIVED_AT_ORIGIN',
          createdAt: new Date('2026-01-10T08:00:00Z'),
        },
      ]);

      const csv = await service.getPackagesExportCsv('org-1');

      expect(csv).toContain('Desconocido');
      expect(csv).toContain('N/A');
    });
  });
});
