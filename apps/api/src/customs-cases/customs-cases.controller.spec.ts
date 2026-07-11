import { Test, TestingModule } from '@nestjs/testing';
import { CustomsCasesController } from './customs-cases.controller';
import { CustomsCasesService } from './customs-cases.service';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';

describe('CustomsCasesController', () => {
  let controller: CustomsCasesController;
  let service: jest.Mocked<CustomsCasesService>;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomsCasesController],
      providers: [
        {
          provide: CustomsCasesService,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            recordEvent: jest.fn(),
            changeStatus: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<CustomsCasesController>(CustomsCasesController);
    service = module.get(CustomsCasesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll should call service', async () => {
    service.findAll.mockResolvedValue({ items: [], total: 0 });
    expect(await controller.findAll(mockContext)).toEqual({
      items: [],
      total: 0,
    });
    expect(service.findAll).toHaveBeenCalledWith(mockContext, {});
  });

  it('create should call service', async () => {
    const res = { id: 'case-1' } as any;
    service.create.mockResolvedValue(res);
    expect(
      await controller.create(mockContext, { caseNumber: '123' } as any),
    ).toEqual(res);
    expect(service.create).toHaveBeenCalledWith(mockContext, {
      caseNumber: '123',
    });
  });

  it('findById should call service', async () => {
    const res = { id: 'case-1' } as any;
    service.findById.mockResolvedValue(res);
    expect(await controller.findById(mockContext, 'case-1')).toEqual(res);
    expect(service.findById).toHaveBeenCalledWith(mockContext, 'case-1');
  });

  it('recordEvent should call service', async () => {
    const res = { id: 'event-1' } as any;
    service.recordEvent.mockResolvedValue(res);
    expect(
      await controller.recordEvent(mockContext, 'case-1', {
        source: 'DGA',
      } as any),
    ).toEqual(res);
    expect(service.recordEvent).toHaveBeenCalledWith(mockContext, 'case-1', {
      source: 'DGA',
    });
  });

  it('changeStatus should call service', async () => {
    const res = { id: 'case-1', status: 'CLOSED' } as any;
    service.changeStatus.mockResolvedValue(res);
    expect(
      await controller.changeStatus(mockContext, 'case-1', {
        status: 'CLOSED',
      } as any),
    ).toEqual(res);
    expect(service.changeStatus).toHaveBeenCalledWith(mockContext, 'case-1', {
      status: 'CLOSED',
    });
  });
});
