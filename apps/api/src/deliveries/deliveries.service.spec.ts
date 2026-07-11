import { Test, TestingModule } from '@nestjs/testing';
import { DeliveriesService } from './deliveries.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, PackageStatus } from '../generated/prisma/client';

describe('DeliveriesService', () => {
  let service: DeliveriesService;
  let prisma: any;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  const mockDelivery = {
    id: 'del-1',
    organizationId: 'org-1',
    deliveryNumber: 'DEL-001',
    status: DeliveryStatus.DRAFT,
    customerId: 'cust-1',
    method: 'HOME_DELIVERY',
    createdAt: new Date(),
    items: [],
    attempts: [],
    customer: { firstName: 'John', lastName: 'Doe' },
  };

  beforeEach(async () => {
    prisma = {
      deliveryOrder: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      package: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      deliveryAttempt: {
        create: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn(prisma)),
      outboxEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DeliveriesService>(DeliveriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all deliveries for the organization', async () => {
      prisma.deliveryOrder.findMany.mockResolvedValue([mockDelivery]);
      const result = await service.findAll(mockContext);
      expect(result).toEqual([mockDelivery]);
      expect(prisma.deliveryOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if delivery not found', async () => {
      prisma.deliveryOrder.findUnique.mockResolvedValue(null);
      await expect(service.findOne(mockContext, 'del-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return delivery if found', async () => {
      prisma.deliveryOrder.findUnique.mockResolvedValue(mockDelivery);
      const result = await service.findOne(mockContext, 'del-1');
      expect(result).toEqual(mockDelivery);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if actorEmployeeId is missing', async () => {
      const ctxNoEmp = { ...mockContext, actorEmployeeId: undefined };
      await expect(
        service.create(ctxNoEmp, {
          deliveryNumber: 'DEL-001',
          customerId: 'cust-1',
          method: 'HOME_DELIVERY',
          packageIds: ['pkg-1'],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if packages not found', async () => {
      prisma.package.findMany.mockResolvedValue([]);
      await expect(
        service.create(mockContext, {
          deliveryNumber: 'DEL-001',
          customerId: 'cust-1',
          method: 'HOME_DELIVERY',
          packageIds: ['pkg-missing'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if packages have wrong status', async () => {
      prisma.package.findMany.mockResolvedValue([
        { id: 'pkg-1', customerId: 'cust-1', status: PackageStatus.IN_TRANSIT },
      ]);
      await expect(
        service.create(mockContext, {
          deliveryNumber: 'DEL-001',
          customerId: 'cust-1',
          method: 'HOME_DELIVERY',
          packageIds: ['pkg-1'],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create delivery when packages are valid', async () => {
      prisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          customerId: 'cust-1',
          status: PackageStatus.ARRIVED_AT_DESTINATION,
        },
      ]);
      prisma.deliveryOrder.create.mockResolvedValue(mockDelivery);
      prisma.outboxEvent.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.create(mockContext, {
        deliveryNumber: 'DEL-001',
        customerId: 'cust-1',
        method: 'HOME_DELIVERY',
        packageIds: ['pkg-1'],
      });
      expect(result).toEqual(mockDelivery);
      expect(prisma.deliveryOrder.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw ConflictException if delivery is not DRAFT', async () => {
      prisma.deliveryOrder.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.READY,
      });
      await expect(
        service.update(mockContext, 'del-1', { notes: 'changed' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update delivery if in DRAFT status', async () => {
      prisma.deliveryOrder.findUnique.mockResolvedValue(mockDelivery);
      const updated = { ...mockDelivery, notes: 'updated' };
      prisma.deliveryOrder.update.mockResolvedValue(updated);
      prisma.outboxEvent.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.update(mockContext, 'del-1', {
        notes: 'updated',
      });
      expect(result).toEqual(updated);
    });
  });
});
