import { Test, TestingModule } from '@nestjs/testing';
import { CorrectionsController } from './corrections.controller';
import { CorrectionsService } from './corrections.service';
import { CorrectionStatus } from '../generated/prisma/client';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';

describe('CorrectionsController', () => {
  let controller: CorrectionsController;
  let service: jest.Mocked<CorrectionsService>;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CorrectionsController],
      providers: [
        {
          provide: CorrectionsService,
          useValue: {
            createCorrectionRequest: jest.fn(),
            getCorrectionRequests: jest.fn(),
            getCorrectionRequestById: jest.fn(),
            updateCorrectionRequest: jest.fn(),
            approveCorrectionRequest: jest.fn(),
            rejectCorrectionRequest: jest.fn(),
            applyCorrectionRequest: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<CorrectionsController>(CorrectionsController);
    service = module.get(CorrectionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createCorrectionRequest should call service and return result', async () => {
    const corr = { id: 'corr-1' } as any;
    service.createCorrectionRequest.mockResolvedValue(corr);
    const dto = {
      targetType: 'PACKAGE',
      targetId: 'pkg-1',
      reason: 'reason',
      proposedData: {},
    } as any;

    expect(await controller.createCorrectionRequest(mockContext, dto)).toEqual(
      corr,
    );
    expect(service.createCorrectionRequest).toHaveBeenCalledWith(
      mockContext,
      dto,
    );
  });

  it('getCorrectionRequests should call service and return result', async () => {
    service.getCorrectionRequests.mockResolvedValue([]);
    expect(
      await controller.getCorrectionRequests(mockContext, 'PACKAGE', 'pkg-1'),
    ).toEqual([]);
    expect(service.getCorrectionRequests).toHaveBeenCalledWith(
      'org-1',
      'PACKAGE',
      'pkg-1',
    );
  });

  it('getCorrectionRequestById should call service and return result', async () => {
    const corr = { id: 'corr-1' } as any;
    service.getCorrectionRequestById.mockResolvedValue(corr);
    expect(
      await controller.getCorrectionRequestById(mockContext, 'corr-1'),
    ).toEqual(corr);
    expect(service.getCorrectionRequestById).toHaveBeenCalledWith(
      'org-1',
      'corr-1',
    );
  });

  it('updateCorrectionRequest should call service and return result', async () => {
    const corr = { id: 'corr-1' } as any;
    service.updateCorrectionRequest.mockResolvedValue(corr);
    const dto = { status: CorrectionStatus.APPROVED, reason: 'ok' };

    expect(
      await controller.updateCorrectionRequest(mockContext, 'corr-1', dto),
    ).toEqual(corr);
    expect(service.updateCorrectionRequest).toHaveBeenCalledWith(
      mockContext,
      'corr-1',
      dto,
    );
  });

  it('approveCorrectionRequest should call service and return result', async () => {
    const corr = { id: 'corr-1', status: CorrectionStatus.APPROVED } as any;
    service.approveCorrectionRequest.mockResolvedValue(corr);
    const dto = { reason: 'approved data change' };

    expect(
      await controller.approveCorrectionRequest(mockContext, 'corr-1', dto),
    ).toEqual(corr);
    expect(service.approveCorrectionRequest).toHaveBeenCalledWith(
      mockContext,
      'corr-1',
      dto,
    );
  });

  it('rejectCorrectionRequest should call service and return result', async () => {
    const corr = { id: 'corr-1', status: CorrectionStatus.REJECTED } as any;
    service.rejectCorrectionRequest.mockResolvedValue(corr);
    const dto = { reason: 'insufficient evidence' };

    expect(
      await controller.rejectCorrectionRequest(mockContext, 'corr-1', dto),
    ).toEqual(corr);
    expect(service.rejectCorrectionRequest).toHaveBeenCalledWith(
      mockContext,
      'corr-1',
      dto,
    );
  });

  it('applyCorrectionRequest should call service and return result', async () => {
    const corr = { id: 'corr-1', status: CorrectionStatus.APPLIED } as any;
    service.applyCorrectionRequest.mockResolvedValue(corr);

    expect(
      await controller.applyCorrectionRequest(mockContext, 'corr-1'),
    ).toEqual(corr);
    expect(service.applyCorrectionRequest).toHaveBeenCalledWith(
      mockContext,
      'corr-1',
    );
  });
});
