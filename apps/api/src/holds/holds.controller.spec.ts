import { Test, TestingModule } from '@nestjs/testing';
import { HoldsController } from './holds.controller';
import { HoldsService } from './holds.service';
import { HoldStatus } from '../generated/prisma/client';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';

describe('HoldsController', () => {
  let controller: HoldsController;
  let service: jest.Mocked<HoldsService>;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HoldsController],
      providers: [
        {
          provide: HoldsService,
          useValue: {
            createHold: jest.fn(),
            getHolds: jest.fn(),
            getHoldById: jest.fn(),
            releaseHold: jest.fn(),
            updateHold: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<HoldsController>(HoldsController);
    service = module.get(HoldsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createHold should call service and return result', async () => {
    const hold = { id: 'hold-1' } as any;
    service.createHold.mockResolvedValue(hold);
    const dto = { packageId: 'pkg-1', reason: 'reason' };

    expect(await controller.createHold(mockContext, dto)).toEqual(hold);
    expect(service.createHold).toHaveBeenCalledWith(mockContext, dto);
  });

  it('getHolds should call service and return result', async () => {
    service.getHolds.mockResolvedValue([]);
    expect(await controller.getHolds(mockContext, 'pkg-1')).toEqual([]);
    expect(service.getHolds).toHaveBeenCalledWith('org-1', 'pkg-1');
  });

  it('getHoldById should call service and return result', async () => {
    const hold = { id: 'hold-1' } as any;
    service.getHoldById.mockResolvedValue(hold);
    expect(await controller.getHoldById(mockContext, 'hold-1')).toEqual(hold);
    expect(service.getHoldById).toHaveBeenCalledWith('org-1', 'hold-1');
  });

  it('updateHold should call service and return result', async () => {
    const hold = { id: 'hold-1' } as any;
    service.updateHold.mockResolvedValue(hold);
    const dto = { status: HoldStatus.RELEASED, releaseReason: 'ok' };

    expect(await controller.updateHold(mockContext, 'hold-1', dto)).toEqual(
      hold,
    );
    expect(service.updateHold).toHaveBeenCalledWith(mockContext, 'hold-1', dto);
  });

  it('releaseHold should call service and return result', async () => {
    const hold = { id: 'hold-1', status: HoldStatus.RELEASED } as any;
    service.releaseHold.mockResolvedValue(hold);
    const dto = { releaseReason: 'validated release' };

    expect(await controller.releaseHold(mockContext, 'hold-1', dto)).toEqual(
      hold,
    );
    expect(service.releaseHold).toHaveBeenCalledWith(
      mockContext,
      'hold-1',
      dto,
    );
  });
});
