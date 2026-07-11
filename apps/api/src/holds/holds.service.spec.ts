import { Test, TestingModule } from '@nestjs/testing';
import { HoldsService } from './holds.service';
import { PrismaHoldsRepository } from './prisma-holds.repository';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { HoldStatus } from '../generated/prisma/client';

describe('HoldsService', () => {
  let service: HoldsService;
  let repository: jest.Mocked<PrismaHoldsRepository>;
  let prisma: jest.Mocked<PrismaService>;

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
        HoldsService,
        {
          provide: PrismaHoldsRepository,
          useValue: {
            create: jest.fn(),
            findMany: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            outboxEvent: {
              create: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<HoldsService>(HoldsService);
    repository = module.get(PrismaHoldsRepository);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createHold', () => {
    it('should throw if employee id is missing', async () => {
      await expect(
        service.createHold(
          { ...mockContext, actorEmployeeId: null },
          { packageId: 'pkg-1', reason: 'test' },
        ),
      ).rejects.toThrow('Employee ID is required');
    });

    it('should create a hold and write audit event', async () => {
      const createdHold = { id: 'hold-1', status: HoldStatus.ACTIVE } as any;
      repository.create.mockResolvedValue(createdHold);

      const result = await service.createHold(mockContext, {
        packageId: 'pkg-1',
        reason: 'Custom reason',
      });
      expect(result).toEqual(createdHold);
      expect(repository.create).toHaveBeenCalledWith({
        organizationId: 'org-1',
        targetType: 'PACKAGE',
        targetId: 'pkg-1',
        reason: 'Custom reason',
        status: HoldStatus.ACTIVE,
        requestedByEmployeeId: 'emp-1',
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalled(); // via PrismaAuditOutboxWriter
    });
  });

  describe('getHoldById', () => {
    it('should return hold if found', async () => {
      const hold = { id: 'hold-1' } as any;
      repository.findById.mockResolvedValue(hold);
      expect(await service.getHoldById('org-1', 'hold-1')).toEqual(hold);
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getHoldById('org-1', 'hold-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateHold', () => {
    it('should release hold and write audit event if status changed to RELEASED', async () => {
      const existingHold = {
        id: 'hold-1',
        status: HoldStatus.ACTIVE,
        reason: 'test',
      } as any;
      const updatedHold = {
        id: 'hold-1',
        status: HoldStatus.RELEASED,
        releaseReason: 'ok',
      } as any;

      repository.findById.mockResolvedValue(existingHold);
      repository.update.mockResolvedValue(updatedHold);

      const result = await service.updateHold(mockContext, 'hold-1', {
        status: HoldStatus.RELEASED,
        releaseReason: 'ok',
      });
      expect(result).toEqual(updatedHold);
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });
});
