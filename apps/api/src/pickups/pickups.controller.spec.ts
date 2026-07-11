import { Test, TestingModule } from '@nestjs/testing';
import { PickupRequestsController } from './pickups.controller';
import { PickupRequestsService } from './pickups.service';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';

describe('PickupRequestsController', () => {
  let controller: PickupRequestsController;
  let service: jest.Mocked<PickupRequestsService>;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PickupRequestsController],
      providers: [
        {
          provide: PickupRequestsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            markAsReady: jest.fn(),
            complete: jest.fn(),
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

    controller = module.get<PickupRequestsController>(PickupRequestsController);
    service = module.get(PickupRequestsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should call service', async () => {
    const res = { id: 'pu-1' } as any;
    service.create.mockResolvedValue(res);
    const dto = {} as any;
    expect(await controller.create(mockContext, dto)).toEqual(res);
    expect(service.create).toHaveBeenCalledWith(mockContext, dto);
  });

  it('findAll should call service', async () => {
    service.findAll.mockResolvedValue([]);
    expect(await controller.findAll(mockContext)).toEqual([]);
    expect(service.findAll).toHaveBeenCalledWith(mockContext);
  });

  it('findOne should call service', async () => {
    const res = { id: 'pu-1' } as any;
    service.findOne.mockResolvedValue(res);
    expect(await controller.findOne(mockContext, 'pu-1')).toEqual(res);
    expect(service.findOne).toHaveBeenCalledWith(mockContext, 'pu-1');
  });

  it('update should call service', async () => {
    const res = { id: 'pu-1' } as any;
    service.update.mockResolvedValue(res);
    const dto = {} as any;
    expect(await controller.update(mockContext, 'pu-1', dto)).toEqual(res);
    expect(service.update).toHaveBeenCalledWith(mockContext, 'pu-1', dto);
  });

  it('markAsReady should call service', async () => {
    const res = { id: 'pu-1' } as any;
    service.markAsReady.mockResolvedValue(res);
    expect(await controller.markAsReady(mockContext, 'pu-1')).toEqual(res);
    expect(service.markAsReady).toHaveBeenCalledWith(mockContext, 'pu-1');
  });

  it('complete should call service', async () => {
    const res = { id: 'pu-1' } as any;
    service.complete.mockResolvedValue(res);
    expect(await controller.complete(mockContext, 'pu-1')).toEqual(res);
    expect(service.complete).toHaveBeenCalledWith(mockContext, 'pu-1');
  });

  it('cancel should call service', async () => {
    const res = { id: 'pu-1' } as any;
    service.cancel.mockResolvedValue(res);
    expect(await controller.cancel(mockContext, 'pu-1')).toEqual(res);
    expect(service.cancel).toHaveBeenCalledWith(mockContext, 'pu-1');
  });
});
