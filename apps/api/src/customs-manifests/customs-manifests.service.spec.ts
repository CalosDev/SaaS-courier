import { Test, TestingModule } from '@nestjs/testing';
import { CustomsManifestsService } from './customs-manifests.service';
import { CustomsManifestsRepositoryToken } from './customs-manifests.repository';
import { PrismaService } from '../prisma/prisma.service';
import { SigaApiService } from '../siga-integration/siga-api.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomsManifestStatus } from '../generated/prisma/client';

describe('CustomsManifestsService', () => {
  let service: CustomsManifestsService;
  let repository: any;
  let prisma: any;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    repository = {
      findMany: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findDetailById: jest.fn(),
      update: jest.fn(),
      addPackages: jest.fn(),
      removePackages: jest.fn(),
      updateStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomsManifestsService,
        {
          provide: CustomsManifestsRepositoryToken,
          useValue: repository,
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
        {
          provide: SigaApiService,
          useValue: {
            transmitManifest: jest.fn().mockResolvedValue({
              success: true,
              sigaReferenceCode: 'SIGA-2026-000001',
              transmittedAt: new Date().toISOString(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CustomsManifestsService>(CustomsManifestsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create manifest and write audit', async () => {
      const manifest = {
        id: 'man-1',
        flightNumber: 'FL123',
        arrivalDate: new Date(),
      };
      repository.create.mockResolvedValue(manifest);

      const res = await service.create(mockContext, {
        flightNumber: 'FL123',
        arrivalDate: new Date().toISOString(),
      });
      expect(res).toEqual(manifest);
      expect(repository.create).toHaveBeenCalled();
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return organization manifests', async () => {
      const manifests = [{ id: 'man-1' }];
      repository.findMany.mockResolvedValue(manifests);

      await expect(service.list(mockContext)).resolves.toEqual(manifests);
      expect(repository.findMany).toHaveBeenCalledWith('org-1');
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById(mockContext, 'man-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return manifest if found', async () => {
      const manifest = { id: 'man-1' };
      repository.findById.mockResolvedValue(manifest);
      expect(await service.findById(mockContext, 'man-1')).toEqual(manifest);
    });
  });

  describe('findDetailById', () => {
    it('should throw NotFoundException if detail is not found', async () => {
      repository.findDetailById.mockResolvedValue(null);
      await expect(
        service.findDetailById(mockContext, 'man-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return manifest detail with packages if found', async () => {
      const manifest = {
        id: 'man-1',
        packages: [{ id: 'pkg-1', internalTrackingNumber: 'PK-001' }],
      };
      repository.findDetailById.mockResolvedValue(manifest);

      expect(await service.findDetailById(mockContext, 'man-1')).toEqual(
        manifest,
      );
      expect(repository.findDetailById).toHaveBeenCalledWith('org-1', 'man-1');
    });
  });

  describe('update', () => {
    it('should throw ConflictException if not DRAFT', async () => {
      repository.findById.mockResolvedValue({
        status: CustomsManifestStatus.SUBMITTED,
      });
      await expect(service.update(mockContext, 'man-1', {})).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update manifest and write audit', async () => {
      const existing = {
        id: 'man-1',
        status: CustomsManifestStatus.DRAFT,
        flightNumber: 'A',
      };
      const updated = {
        id: 'man-1',
        status: CustomsManifestStatus.DRAFT,
        flightNumber: 'B',
      };
      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue(updated);

      const res = await service.update(mockContext, 'man-1', {
        flightNumber: 'B',
      });
      expect(res).toEqual(updated);
      expect(repository.update).toHaveBeenCalledWith(
        'org-1',
        'man-1',
        {
          flightNumber: 'B',
        },
        prisma,
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('addPackages', () => {
    it('should throw ConflictException if not DRAFT', async () => {
      repository.findById.mockResolvedValue({
        status: CustomsManifestStatus.SUBMITTED,
      });
      await expect(
        service.addPackages(mockContext, 'man-1', { packageIds: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('should add packages and write audit', async () => {
      repository.findById.mockResolvedValue({
        status: CustomsManifestStatus.DRAFT,
      });
      await service.addPackages(mockContext, 'man-1', {
        packageIds: ['pkg-1'],
      });
      expect(repository.addPackages).toHaveBeenCalledWith(
        'org-1',
        'man-1',
        ['pkg-1'],
        prisma,
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('removePackages', () => {
    it('should throw ConflictException if not DRAFT', async () => {
      repository.findById.mockResolvedValue({
        status: CustomsManifestStatus.SUBMITTED,
      });
      await expect(
        service.removePackages(mockContext, 'man-1', { packageIds: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('should remove packages and write audit', async () => {
      repository.findById.mockResolvedValue({
        status: CustomsManifestStatus.DRAFT,
      });
      await service.removePackages(mockContext, 'man-1', {
        packageIds: ['pkg-1'],
      });
      expect(repository.removePackages).toHaveBeenCalledWith(
        'org-1',
        'man-1',
        ['pkg-1'],
        prisma,
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });
});
