import { Test, TestingModule } from '@nestjs/testing';
import { CustomsManifestsController } from './customs-manifests.controller';
import { CustomsManifestsService } from './customs-manifests.service';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';
import { CustomsManifestsRepositoryToken } from './customs-manifests.repository';

describe('CustomsManifestsController', () => {
  let controller: CustomsManifestsController;
  let service: jest.Mocked<CustomsManifestsService>;
  let repository: any;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    repository = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomsManifestsController],
      providers: [
        {
          provide: CustomsManifestsService,
          useValue: {
            list: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findDetailById: jest.fn(),
            update: jest.fn(),
            addPackages: jest.fn(),
            removePackages: jest.fn(),
          },
        },
        {
          provide: CustomsManifestsRepositoryToken,
          useValue: repository,
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<CustomsManifestsController>(
      CustomsManifestsController,
    );
    service = module.get(CustomsManifestsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('does not expose simulated SIGA transmission', () => {
    expect('transmit' in controller).toBe(false);
  });

  it('create should call service', async () => {
    const res = { id: 'man-1' } as any;
    service.create.mockResolvedValue(res);
    expect(await controller.create(mockContext, {} as any)).toEqual(res);
    expect(service.create).toHaveBeenCalledWith(mockContext, {});
  });

  it('list should call service', async () => {
    const res = [{ id: 'man-1' }] as any;
    service.list.mockResolvedValue(res);
    expect(await controller.list(mockContext)).toEqual(res);
    expect(service.list).toHaveBeenCalledWith(mockContext);
  });

  it('findOne should call service', async () => {
    const res = { id: 'man-1', packages: [{ id: 'pkg-1' }] } as any;
    service.findDetailById.mockResolvedValue(res);
    expect(await controller.findOne(mockContext, 'man-1')).toEqual(res);
    expect(service.findDetailById).toHaveBeenCalledWith(mockContext, 'man-1');
  });

  it('update should call service', async () => {
    const res = { id: 'man-1' } as any;
    service.update.mockResolvedValue(res);
    expect(await controller.update(mockContext, 'man-1', {} as any)).toEqual(
      res,
    );
    expect(service.update).toHaveBeenCalledWith(mockContext, 'man-1', {});
  });

  it('addPackages should call service', async () => {
    service.addPackages.mockResolvedValue();
    await controller.addPackages(mockContext, 'man-1', {
      packageIds: ['pkg-1'],
    });
    expect(service.addPackages).toHaveBeenCalledWith(mockContext, 'man-1', {
      packageIds: ['pkg-1'],
    });
  });

  it('removePackages should call service', async () => {
    service.removePackages.mockResolvedValue();
    await controller.removePackages(mockContext, 'man-1', {
      packageIds: ['pkg-1'],
    });
    expect(service.removePackages).toHaveBeenCalledWith(mockContext, 'man-1', {
      packageIds: ['pkg-1'],
    });
  });
});
