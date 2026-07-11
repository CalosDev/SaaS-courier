import { Test, TestingModule } from '@nestjs/testing';
import { CorrectionsService } from './corrections.service';
import { PrismaCorrectionsRepository } from './prisma-corrections.repository';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CorrectionStatus } from '../generated/prisma/client';

describe('CorrectionsService', () => {
  let service: CorrectionsService;
  let repository: jest.Mocked<PrismaCorrectionsRepository>;
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
        CorrectionsService,
        {
          provide: PrismaCorrectionsRepository,
          useValue: {
            create: jest.fn(),
            findMany: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            recordDecision: jest.fn(),
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

    service = module.get<CorrectionsService>(CorrectionsService);
    repository = module.get(PrismaCorrectionsRepository);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCorrectionRequest', () => {
    it('should throw if employee id is missing', async () => {
      await expect(
        service.createCorrectionRequest(
          { ...mockContext, actorEmployeeId: undefined },
          {
            targetType: 'PACKAGE',
            targetId: 'pkg-1',
            reason: 'test',
            proposedData: {},
          },
        ),
      ).rejects.toThrow('Employee ID is required');
    });

    it('should create a correction and write audit event', async () => {
      const createdCorrection = {
        id: 'corr-1',
        status: CorrectionStatus.REQUESTED,
      } as any;
      repository.create.mockResolvedValue(createdCorrection);

      const dto = {
        targetType: 'PACKAGE',
        targetId: 'pkg-1',
        reason: 'test',
        proposedData: { w: 10 },
      };
      const result = await service.createCorrectionRequest(
        mockContext,
        dto as any,
      );
      expect(result).toEqual(createdCorrection);
      expect(repository.create).toHaveBeenCalledWith({
        organizationId: 'org-1',
        targetType: 'PACKAGE',
        targetId: 'pkg-1',
        reason: 'test',
        proposedData: { w: 10 },
        status: CorrectionStatus.REQUESTED,
        requestedByEmployeeId: 'emp-1',
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalled(); // via PrismaAuditOutboxWriter
    });
  });

  describe('getCorrectionRequestById', () => {
    it('should return correction if found', async () => {
      const corr = { id: 'corr-1' } as any;
      repository.findById.mockResolvedValue(corr);
      expect(await service.getCorrectionRequestById('org-1', 'corr-1')).toEqual(
        corr,
      );
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.getCorrectionRequestById('org-1', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCorrectionRequest', () => {
    it('should update correction status, record decision and write audit event', async () => {
      const existing = {
        id: 'corr-1',
        status: CorrectionStatus.REQUESTED,
      } as any;
      const updated = {
        id: 'corr-1',
        status: CorrectionStatus.APPROVED,
      } as any;

      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue(updated);
      repository.recordDecision.mockResolvedValue({} as any);

      const dto = { status: CorrectionStatus.APPROVED, reason: 'ok' };
      const result = await service.updateCorrectionRequest(
        mockContext,
        'corr-1',
        dto,
      );
      expect(result).toEqual(updated);
      expect(repository.recordDecision).toHaveBeenCalledWith(
        'org-1',
        'corr-1',
        'emp-1',
        CorrectionStatus.APPROVED,
        'ok',
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });
});
