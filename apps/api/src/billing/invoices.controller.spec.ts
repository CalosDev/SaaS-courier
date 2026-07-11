import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { SessionAuthGuard } from '../auth/http/session-auth.guard';
import { PermissionsGuard } from '../rbac/http/permissions.guard';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: jest.Mocked<InvoicesService>;

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
      controllers: [InvoicesController],
      providers: [
        {
          provide: InvoicesService,
          useValue: {
            createInvoice: jest.fn(),
            listInvoices: jest.fn(),
            getInvoice: jest.fn(),
            updateInvoice: jest.fn(),
            issueInvoice: jest.fn(),
            voidInvoice: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<InvoicesController>(InvoicesController);
    service = module.get(InvoicesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should call service', async () => {
    const res = { id: 'inv-1' } as any;
    service.createInvoice.mockResolvedValue(res);
    const dto = {} as any;
    expect(await controller.create(mockSession, dto, mockContext)).toEqual(res);
    expect(service.createInvoice).toHaveBeenCalledWith(
      'org-1',
      dto,
      mockContext,
    );
  });

  it('list should call service', async () => {
    service.listInvoices.mockResolvedValue([]);
    expect(await controller.list(mockSession)).toEqual({ items: [] });
    expect(service.listInvoices).toHaveBeenCalledWith('org-1');
  });

  it('get should call service', async () => {
    const res = { id: 'inv-1' } as any;
    service.getInvoice.mockResolvedValue(res);
    expect(await controller.get(mockSession, 'inv-1')).toEqual(res);
    expect(service.getInvoice).toHaveBeenCalledWith('org-1', 'inv-1');
  });

  it('update should call service', async () => {
    const res = { id: 'inv-1' } as any;
    service.updateInvoice.mockResolvedValue(res);
    const dto = {} as any;
    expect(
      await controller.update(mockSession, 'inv-1', dto, mockContext),
    ).toEqual(res);
    expect(service.updateInvoice).toHaveBeenCalledWith(
      'org-1',
      'inv-1',
      dto,
      mockContext,
    );
  });

  it('issue should call service', async () => {
    const res = { id: 'inv-1' } as any;
    service.issueInvoice.mockResolvedValue(res);
    expect(await controller.issue(mockSession, 'inv-1', mockContext)).toEqual(
      res,
    );
    expect(service.issueInvoice).toHaveBeenCalledWith(
      'org-1',
      'inv-1',
      mockContext,
    );
  });

  it('voidInvoice should call service', async () => {
    const res = { id: 'inv-1' } as any;
    service.voidInvoice.mockResolvedValue(res);
    const dto = { reason: 'mistake' } as any;
    expect(
      await controller.voidInvoice(mockSession, 'inv-1', dto, mockContext),
    ).toEqual(res);
    expect(service.voidInvoice).toHaveBeenCalledWith(
      'org-1',
      'inv-1',
      dto,
      mockContext,
    );
  });
});
