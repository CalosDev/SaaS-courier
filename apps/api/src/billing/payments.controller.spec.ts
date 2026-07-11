import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: jest.Mocked<PaymentsService>;

  const mockSession = {
    sessionId: 'session-1',
    userId: 'user-1',
    organizationId: 'org-1',
    roles: [],
    permissions: [],
  } as any;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            createPayment: jest.fn(),
            listPayments: jest.fn(),
            getPayment: jest.fn(),
            applyPayment: jest.fn(),
            voidPayment: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should call service', async () => {
    const res = { id: 'pay-1' } as any;
    service.createPayment.mockResolvedValue(res);
    const dto = {} as any;
    expect(await controller.create(mockSession, dto, mockContext)).toEqual(res);
    expect(service.createPayment).toHaveBeenCalledWith(
      'org-1',
      dto,
      mockContext,
    );
  });

  it('list should call service', async () => {
    service.listPayments.mockResolvedValue([]);
    expect(await controller.list(mockSession)).toEqual({ items: [] });
    expect(service.listPayments).toHaveBeenCalledWith('org-1');
  });

  it('get should call service', async () => {
    const res = { id: 'pay-1' } as any;
    service.getPayment.mockResolvedValue(res);
    expect(await controller.get(mockSession, 'pay-1')).toEqual(res);
    expect(service.getPayment).toHaveBeenCalledWith('org-1', 'pay-1');
  });

  it('apply should call service', async () => {
    const res = { id: 'pay-1' } as any;
    service.applyPayment.mockResolvedValue(res);
    const dto = {} as any;
    expect(
      await controller.apply(mockSession, 'pay-1', dto, mockContext),
    ).toEqual(res);
    expect(service.applyPayment).toHaveBeenCalledWith(
      'org-1',
      'pay-1',
      dto,
      mockContext,
    );
  });

  it('voidPayment should call service', async () => {
    const res = { id: 'pay-1' } as any;
    service.voidPayment.mockResolvedValue(res);
    const dto = { reason: 'mistake' } as any;
    expect(
      await controller.voidPayment(mockSession, 'pay-1', dto, mockContext),
    ).toEqual(res);
    expect(service.voidPayment).toHaveBeenCalledWith(
      'org-1',
      'pay-1',
      dto,
      mockContext,
    );
  });
});
