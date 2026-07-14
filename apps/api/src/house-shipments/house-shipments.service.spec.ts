import { Test, TestingModule } from '@nestjs/testing';
import { HouseShipmentsService } from './house-shipments.service';
import { HouseShipmentsRepository } from './house-shipments.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('HouseShipmentsService', () => {
  let service: HouseShipmentsService;
  let repository: jest.Mocked<HouseShipmentsRepository>;
  let prisma: any;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseShipmentsService,
        {
          provide: HouseShipmentsRepository,
          useValue: {
            create: jest.fn(),
            findByDispatchId: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            addPackages: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            houseShipment: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            dispatch: {
              findUnique: jest.fn(),
            },
            package: {
              findMany: jest.fn(),
            },
            houseShipmentPackage: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            outboxEvent: {
              create: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
      ],
    }).compile();

    service = module.get<HouseShipmentsService>(HouseShipmentsService);
    repository = module.get(HouseShipmentsRepository);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if HAWB already exists', async () => {
      prisma.houseShipment.findUnique.mockResolvedValue({ id: 'exists' });
      await expect(
        service.create(mockContext, 'disp-1', { hawb: '123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if dispatch not found', async () => {
      prisma.houseShipment.findUnique.mockResolvedValue(null);
      prisma.dispatch.findUnique.mockResolvedValue(null);
      await expect(
        service.create(mockContext, 'disp-1', { hawb: '123' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create shipment and write audit', async () => {
      prisma.houseShipment.findUnique.mockResolvedValue(null);
      prisma.dispatch.findUnique.mockResolvedValue({ id: 'disp-1' });
      const shipment = { id: 'hs-1', hawb: '123' } as any;
      repository.create.mockResolvedValue(shipment);

      const res = await service.create(mockContext, 'disp-1', { hawb: '123' });
      expect(res).toEqual(shipment);
      expect(repository.create).toHaveBeenCalledWith('org-1', 'disp-1', {
        hawb: '123',
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('addPackages', () => {
    it('should throw ConflictException if not DRAFT', async () => {
      prisma.houseShipment.findUnique.mockResolvedValue({
        status: 'CLOSED',
      });
      await expect(
        service.addPackages(mockContext, 'hs-1', { packageIds: ['pkg-1'] }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if packages length mismatch', async () => {
      prisma.houseShipment.findUnique.mockResolvedValue({
        status: 'DRAFT',
        dispatchId: 'disp-1',
      });
      prisma.package.findMany.mockResolvedValue([]);
      await expect(
        service.addPackages(mockContext, 'hs-1', { packageIds: ['pkg-1'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if package has different dispatchId', async () => {
      prisma.houseShipment.findUnique.mockResolvedValue({
        status: 'DRAFT',
        dispatchId: 'disp-1',
      });
      prisma.package.findMany.mockResolvedValue([
        { id: 'pkg-1', dispatchId: 'disp-2' },
      ]);
      await expect(
        service.addPackages(mockContext, 'hs-1', { packageIds: ['pkg-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add packages and write audit', async () => {
      prisma.houseShipment.findUnique.mockResolvedValue({
        status: 'DRAFT',
        dispatchId: 'disp-1',
      });
      prisma.package.findMany.mockResolvedValue([
        { id: 'pkg-1', dispatchId: 'disp-1' },
      ]);

      await service.addPackages(mockContext, 'hs-1', { packageIds: ['pkg-1'] });
      expect(prisma.houseShipmentPackage.deleteMany).toHaveBeenCalled();
      expect(prisma.houseShipmentPackage.createMany).toHaveBeenCalledWith({
        data: [
          {
            organizationId: 'org-1',
            houseShipmentId: 'hs-1',
            packageId: 'pkg-1',
          },
        ],
        skipDuplicates: true,
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should throw ConflictException if not DRAFT', async () => {
      repository.findById.mockResolvedValue({ status: 'CLOSED' } as any);
      await expect(service.close(mockContext, 'hs-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should close and write audit via transaction', async () => {
      repository.findById.mockResolvedValue({
        id: 'hs-1',
        status: 'DRAFT',
        packages: [{ packageId: 'pkg-1' }],
      } as any);

      await service.close(mockContext, 'hs-1');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.houseShipment.update).toHaveBeenCalledWith({
        where: { organizationId_id: { organizationId: 'org-1', id: 'hs-1' } },
        data: { status: 'CLOSED' },
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });
});
