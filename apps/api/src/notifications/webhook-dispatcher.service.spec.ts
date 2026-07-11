import { Test, TestingModule } from '@nestjs/testing';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

describe('WebhookDispatcherService', () => {
  let service: WebhookDispatcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookDispatcherService],
    }).compile();

    service = module.get<WebhookDispatcherService>(WebhookDispatcherService);
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SIMULATION_URL;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleOutboxEvent', () => {
    it('should return early if payload is null', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.handleOutboxEvent(null);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should return early if payload has no event_type', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.handleOutboxEvent({ id: '1' });
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log the event in simulation mode when no WEBHOOK_SIMULATION_URL is set', async () => {
      delete process.env.WEBHOOK_SIMULATION_URL;
      const debugSpy = jest.spyOn((service as any).logger, 'debug');

      await service.handleOutboxEvent({
        id: 'evt-1',
        event_type: 'package.received',
        organization_id: 'org-1',
        aggregate_type: 'Package',
        aggregate_id: 'pkg-1',
        occurred_at: new Date().toISOString(),
        payload: { test: true },
      });

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULATED WEBHOOK]'),
      );
    });

    it('should attempt HTTP POST when WEBHOOK_SIMULATION_URL is set', async () => {
      process.env.WEBHOOK_SIMULATION_URL = 'http://localhost:9999/webhook';

      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true } as any);

      await service.handleOutboxEvent({
        id: 'evt-2',
        event_type: 'delivery.completed',
        organization_id: 'org-1',
        aggregate_type: 'DeliveryOrder',
        aggregate_id: 'del-1',
        occurred_at: new Date().toISOString(),
        payload: {},
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9999/webhook',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw and log error if webhook HTTP call fails', async () => {
      process.env.WEBHOOK_SIMULATION_URL = 'http://localhost:9999/webhook';

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: false, status: 500 } as any);

      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await expect(
        service.handleOutboxEvent({
          id: 'evt-3',
          event_type: 'package.received',
          organization_id: 'org-1',
          aggregate_type: 'Package',
          aggregate_id: 'pkg-1',
          occurred_at: new Date().toISOString(),
          payload: {},
        }),
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
