import { Test, TestingModule } from '@nestjs/testing';
import { HouseShipmentsController } from './house-shipments.controller';
import { HouseShipmentsService } from './house-shipments.service';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';

import { MasterShipmentsHouseShipmentsController } from './house-shipments.controller';

describe('HouseShipmentsController', () => {
  let controller: HouseShipmentsController;
  let masterController: MasterShipmentsHouseShipmentsController;
  let service: jest.Mocked<HouseShipmentsService>;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        HouseShipmentsController,
        MasterShipmentsHouseShipmentsController,
      ],
      providers: [
        {
          provide: HouseShipmentsService,
          useValue: {
            create: jest.fn(),
            findByDispatchId: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            addPackages: jest.fn(),
            close: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<HouseShipmentsController>(HouseShipmentsController);
    masterController = module.get<MasterShipmentsHouseShipmentsController>(
      MasterShipmentsHouseShipmentsController,
    );
    service = module.get(HouseShipmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(masterController).toBeDefined();
  });

  it('createHouseShipment should call service', async () => {
    const res = { id: 'hs-1' } as any;
    service.create.mockResolvedValue(res);
    expect(
      await masterController.createHouseShipment(mockContext, 'disp-1', {
        hawb: '123',
      } as any),
    ).toEqual(res);
    expect(service.create).toHaveBeenCalledWith(mockContext, 'disp-1', {
      hawb: '123',
    });
  });

  it('getHouseShipments should call service', async () => {
    service.findByDispatchId.mockResolvedValue([]);
    expect(
      await masterController.getHouseShipments(mockContext, 'disp-1'),
    ).toEqual([]);
    expect(service.findByDispatchId).toHaveBeenCalledWith(
      mockContext,
      'disp-1',
    );
  });

  it('getHouseShipment should call service', async () => {
    const res = { id: 'hs-1' } as any;
    service.findById.mockResolvedValue(res);
    expect(await controller.getHouseShipment(mockContext, 'hs-1')).toEqual(res);
    expect(service.findById).toHaveBeenCalledWith(mockContext, 'hs-1');
  });

  it('updateHouseShipment should call service', async () => {
    const res = { id: 'hs-1' } as any;
    service.update.mockResolvedValue(res);
    expect(
      await controller.updateHouseShipment(mockContext, 'hs-1', {
        hawb: '123',
      } as any),
    ).toEqual(res);
    expect(service.update).toHaveBeenCalledWith(mockContext, 'hs-1', {
      hawb: '123',
    });
  });

  it('addPackages should call service', async () => {
    service.addPackages.mockResolvedValue();
    await controller.addPackages(mockContext, 'hs-1', {
      packageIds: ['pkg-1'],
    });
    expect(service.addPackages).toHaveBeenCalledWith(mockContext, 'hs-1', {
      packageIds: ['pkg-1'],
    });
  });

  it('closeHouseShipment should call service', async () => {
    service.close.mockResolvedValue();
    await controller.closeHouseShipment(mockContext, 'hs-1');
    expect(service.close).toHaveBeenCalledWith(mockContext, 'hs-1');
  });

  it('cancelHouseShipment should call service', async () => {
    service.cancel.mockResolvedValue();
    await controller.cancelHouseShipment(mockContext, 'hs-1');
    expect(service.cancel).toHaveBeenCalledWith(mockContext, 'hs-1');
  });
});
