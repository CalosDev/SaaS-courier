import { Test, TestingModule } from '@nestjs/testing';
import { CorrectionsService } from './corrections.service';
import { PrismaCorrectionsRepository } from './prisma-corrections.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
            $transaction: jest.fn((callback) => callback(prisma)),
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
      expect(repository.create).toHaveBeenCalledWith(
        {
          organizationId: 'org-1',
          targetType: 'PACKAGE',
          targetId: 'pkg-1',
          reason: 'test',
          proposedData: { w: 10 },
          status: CorrectionStatus.REQUESTED,
          requestedByEmployeeId: 'emp-1',
        },
        prisma,
      );
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
        prisma,
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('controlled decisions', () => {
    it('approves through the approved transition', async () => {
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

      await service.approveCorrectionRequest(mockContext, 'corr-1', {
        reason: 'approved data change',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'org-1',
        'corr-1',
        { status: CorrectionStatus.APPROVED },
        prisma,
      );
      expect(repository.recordDecision).toHaveBeenCalledWith(
        'org-1',
        'corr-1',
        'emp-1',
        CorrectionStatus.APPROVED,
        'approved data change',
        prisma,
      );
    });

    it('rejects through the rejected transition', async () => {
      const existing = {
        id: 'corr-1',
        status: CorrectionStatus.REQUESTED,
      } as any;
      const updated = {
        id: 'corr-1',
        status: CorrectionStatus.REJECTED,
      } as any;

      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue(updated);
      repository.recordDecision.mockResolvedValue({} as any);

      await service.rejectCorrectionRequest(mockContext, 'corr-1', {
        reason: 'insufficient evidence',
      });

      expect(repository.recordDecision).toHaveBeenCalledWith(
        'org-1',
        'corr-1',
        'emp-1',
        CorrectionStatus.REJECTED,
        'insufficient evidence',
        prisma,
      );
    });

    it('does not mark an approved correction as applied without target rules', async () => {
      repository.findById.mockResolvedValue({
        id: 'corr-1',
        status: CorrectionStatus.APPROVED,
        targetType: 'PACKAGE',
      } as any);

      await expect(
        service.applyCorrectionRequest(mockContext, 'corr-1'),
      ).rejects.toThrow(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.recordDecision).not.toHaveBeenCalled();
    });
  });
});
