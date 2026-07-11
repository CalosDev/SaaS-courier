import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processBatch();
    } catch (error) {
      this.logger.error('Error processing outbox events', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatch() {
    const batchSize = 50;
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + 5 * 60000); // 5 mins lock
    const lockedBy = 'processor-' + Math.random().toString(36).substring(7);

    const lockedEvents: any[] = await this.prisma.$queryRaw`
      WITH batch AS (
        SELECT id FROM outbox_events
        WHERE status = 'PENDING'
          AND available_at <= NOW()
          AND (locked_until IS NULL OR locked_until < NOW())
        ORDER BY created_at ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events e
      SET locked_by = ${lockedBy},
          locked_until = ${lockedUntil},
          processing_started_at = NOW(),
          attempts = e.attempts + 1,
          updated_at = NOW()
      FROM batch
      WHERE e.id = batch.id
      RETURNING e.*;
    `;

    if (!lockedEvents || lockedEvents.length === 0) {
      return;
    }

    this.logger.log(`Processing ${lockedEvents.length} outbox events`);

    for (const event of lockedEvents) {
      try {
        // Emit the event via EventEmitter2 to local NestJS listeners
        await this.eventEmitter.emitAsync(event.event_type, event);

        // Mark as published
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            lockedBy: null,
            lockedUntil: null,
          },
        });

        this.logger.debug(`Successfully processed event ${event.id}`);
      } catch (err: any) {
        this.logger.error(`Failed to process event ${event.id}`, err);

        const maxAttempts = 3;
        const attempts = event.attempts;
        const status = attempts >= maxAttempts ? 'DEAD_LETTER' : 'PENDING';

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status,
            lockedBy: null,
            lockedUntil: null,
            lastErrorCode: err.name || 'Error',
            lastErrorAt: new Date(),
            availableAt:
              status === 'PENDING'
                ? new Date(Date.now() + 5 * 60000)
                : event.available_at,
            ...(status === 'DEAD_LETTER' ? { deadLetteredAt: new Date() } : {}),
          },
        });
      }
    }
  }
}
