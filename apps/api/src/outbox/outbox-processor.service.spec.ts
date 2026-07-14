import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxProcessorService } from './outbox-processor.service';

describe('OutboxProcessorService', () => {
  const event = {
    id: 'event-1',
    event_type: 'report_export.requested',
    attempts: 1,
    available_at: new Date(),
  };

  function createService() {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([event]),
      outboxEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    };

    return {
      service: new OutboxProcessorService(
        prisma as unknown as PrismaService,
        eventEmitter as unknown as EventEmitter2,
      ),
      prisma,
      eventEmitter,
    };
  }

  it('publishes only while it still owns the event lock', async () => {
    const { service, prisma } = createService();

    await service.processOutboxEvents();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: event.id,
          lockedBy: expect.stringMatching(/^processor-/),
        },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });

  it('does not fail when the event is deleted after its handler runs', async () => {
    const { service, prisma } = createService();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processOutboxEvents()).resolves.toBeUndefined();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(1);
  });

  it('releases only its own lock after a handler failure', async () => {
    const { service, prisma, eventEmitter } = createService();
    eventEmitter.emitAsync.mockRejectedValue(new Error('handler failed'));

    await service.processOutboxEvents();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: event.id,
          lockedBy: expect.stringMatching(/^processor-/),
        },
        data: expect.objectContaining({
          status: 'PENDING',
          lastErrorCode: 'Error',
        }),
      }),
    );
  });
});
