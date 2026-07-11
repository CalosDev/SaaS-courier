import { Test, TestingModule } from '@nestjs/testing';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { REQUIRED_PERMISSIONS_KEY } from '../rbac/http/authorization.constants';
import { PermissionsGuard } from '../rbac/http/permissions.guard';
import { SHIPMENT_PERMISSIONS } from '../rbac/permission.catalog';
import { DispatchesService } from './dispatches.service';
import { MasterShipmentsController } from './master-shipments.controller';

describe('MasterShipmentsController', () => {
  let controller: MasterShipmentsController;
  let service: jest.Mocked<DispatchesService>;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterShipmentsController],
      providers: [
        {
          provide: DispatchesService,
          useValue: {
            createDispatch: jest.fn(),
            getDispatches: jest.fn(),
            getDispatchById: jest.fn(),
            updateDispatch: jest.fn(),
            addPackages: jest.fn(),
            removePackages: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<MasterShipmentsController>(
      MasterShipmentsController,
    );
    service = module.get(DispatchesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uses shipment permissions for the master shipment API surface', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        controller.getMasterShipments,
      ),
    ).toEqual([SHIPMENT_PERMISSIONS.VIEW]);
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        controller.getMasterShipmentById,
      ),
    ).toEqual([SHIPMENT_PERMISSIONS.VIEW]);
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        controller.createMasterShipment,
      ),
    ).toEqual([SHIPMENT_PERMISSIONS.MANAGE]);
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        controller.updateMasterShipment,
      ),
    ).toEqual([SHIPMENT_PERMISSIONS.MANAGE]);
    expect(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, controller.addPackages),
    ).toEqual([SHIPMENT_PERMISSIONS.MANAGE]);
    expect(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, controller.removePackages),
    ).toEqual([SHIPMENT_PERMISSIONS.MANAGE]);
  });

  it('getMasterShipments should delegate to dispatch listing', async () => {
    const res = [{ id: 'dispatch-1' }] as any;
    service.getDispatches.mockResolvedValue(res);

    await expect(controller.getMasterShipments(mockContext)).resolves.toEqual(
      res,
    );
    expect(service.getDispatches).toHaveBeenCalledWith('org-1');
  });

  it('getMasterShipmentById should delegate to dispatch lookup', async () => {
    const res = { id: 'dispatch-1' } as any;
    service.getDispatchById.mockResolvedValue(res);

    await expect(
      controller.getMasterShipmentById(mockContext, 'dispatch-1'),
    ).resolves.toEqual(res);
    expect(service.getDispatchById).toHaveBeenCalledWith('org-1', 'dispatch-1');
  });

  it('createMasterShipment should delegate to dispatch creation', async () => {
    const dto = { origin: 'MIA', destination: 'SDQ' };
    const res = { id: 'dispatch-1' } as any;
    service.createDispatch.mockResolvedValue(res);

    await expect(
      controller.createMasterShipment(mockContext, dto),
    ).resolves.toEqual(res);
    expect(service.createDispatch).toHaveBeenCalledWith(mockContext, dto);
  });

  it('updateMasterShipment should delegate to dispatch updates', async () => {
    const dto = { mawb: '001-12345678' };
    const res = { id: 'dispatch-1' } as any;
    service.updateDispatch.mockResolvedValue(res);

    await expect(
      controller.updateMasterShipment(mockContext, 'dispatch-1', dto),
    ).resolves.toEqual(res);
    expect(service.updateDispatch).toHaveBeenCalledWith(
      mockContext,
      'dispatch-1',
      dto,
    );
  });

  it('addPackages should delegate to dispatch package association', async () => {
    const dto = { packageIds: ['package-1'] };
    const res = { id: 'dispatch-1' } as any;
    service.addPackages.mockResolvedValue(res);

    await expect(
      controller.addPackages(mockContext, 'dispatch-1', dto),
    ).resolves.toEqual(res);
    expect(service.addPackages).toHaveBeenCalledWith(
      mockContext,
      'dispatch-1',
      dto,
    );
  });

  it('removePackages should delegate to dispatch package association', async () => {
    const dto = { packageIds: ['package-1'] };
    const res = { id: 'dispatch-1' } as any;
    service.removePackages.mockResolvedValue(res);

    await expect(
      controller.removePackages(mockContext, 'dispatch-1', dto),
    ).resolves.toEqual(res);
    expect(service.removePackages).toHaveBeenCalledWith(
      mockContext,
      'dispatch-1',
      dto,
    );
  });
});
