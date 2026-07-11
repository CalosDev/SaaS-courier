import { Test, TestingModule } from '@nestjs/testing';
import { PickupRequestsService } from './pickups.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../audit/prisma-audit-outbox.writer', () => {
  return {
    PrismaAuditOutboxWriter: jest.fn().mockImplementation(() => ({
      write: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe('PickupRequestsService', () => {
  let service: PickupRequestsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickupRequestsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb(prisma)),
            customer: { findUnique: jest.fn() },
            facility: { findUnique: jest.fn() },
            package: { findMany: jest.fn() },
            pickupRequestItem: { findMany: jest.fn(), deleteMany: jest.fn() },
            pickupRequest: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PickupRequestsService>(PickupRequestsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a pickup request', async () => {
      const mockCustomer = { id: 'cust-1' };
      const mockFacility = { id: 'fac-1' };
      const mockPackages = [{ id: 'pkg-1' }];
      const mockCreated = { id: 'pu-1' };

      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(
        mockCustomer as any,
      );
      (prisma.facility.findUnique as jest.Mock).mockResolvedValue(
        mockFacility as any,
      );
      (prisma.package.findMany as jest.Mock).mockResolvedValue(
        mockPackages as any,
      );
      (prisma.pickupRequestItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.pickupRequest.create as jest.Mock).mockResolvedValue(
        mockCreated as any,
      );

      const dto = {
        customerId: 'cust-1',
        facilityId: 'fac-1',
        packageIds: ['pkg-1'],
      };
      const res = await service.create({ organizationId: 'org-1' } as any, dto);

      expect(res.id).toBe('pu-1');
      expect(prisma.pickupRequest.create).toHaveBeenCalled();
    });
  });

  describe('findAll and findOne', () => {
    it('should find all', async () => {
      (prisma.pickupRequest.findMany as jest.Mock).mockResolvedValue([]);
      expect(await service.findAll({ organizationId: 'org-1' } as any)).toEqual(
        [],
      );
    });

    it('should find one', async () => {
      const mockPu = { id: 'pu-1' };
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue(
        mockPu as any,
      );
      expect(
        await service.findOne({ organizationId: 'org-1' } as any, 'pu-1'),
      ).toEqual(mockPu);
    });
  });

  describe('status updates', () => {
    it('markAsReady should update status to READY', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        status: 'DRAFT',
      } as any);
      const updated = { status: 'READY' };
      (prisma.pickupRequest.update as jest.Mock).mockResolvedValue(
        updated as any,
      );

      const res = await service.markAsReady(
        { organizationId: 'org-1' } as any,
        'pu-1',
      );
      expect(res.status).toBe('READY');
    });

    it('complete should update status to COMPLETED', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        status: 'READY',
      } as any);
      const updated = { status: 'COMPLETED' };
      (prisma.pickupRequest.update as jest.Mock).mockResolvedValue(
        updated as any,
      );

      const res = await service.complete(
        { organizationId: 'org-1' } as any,
        'pu-1',
      );
      expect(res.status).toBe('COMPLETED');
    });

    it('cancel should update status to CANCELLED', async () => {
      (prisma.pickupRequest.findUnique as jest.Mock).mockResolvedValue({
        status: 'DRAFT',
      } as any);
      const updated = { status: 'CANCELLED' };
      (prisma.pickupRequest.update as jest.Mock).mockResolvedValue(
        updated as any,
      );

      const res = await service.cancel(
        { organizationId: 'org-1' } as any,
        'pu-1',
      );
      expect(res.status).toBe('CANCELLED');
    });
  });
});
