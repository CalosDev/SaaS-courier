import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  // Catch all events emitted by the outbox processor
  @OnEvent('**')
  async handleOutboxEvent(payload: any) {
    if (!payload || !payload.event_type) return;

    this.logger.log(
      `Dispatching webhook for event: ${payload.event_type} (Org: ${payload.organization_id})`,
    );

    const webhookUrl = process.env.WEBHOOK_SIMULATION_URL;

    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: payload.id,
            eventType: payload.event_type,
            aggregateType: payload.aggregate_type,
            aggregateId: payload.aggregate_id,
            occurredAt: payload.occurred_at,
            data: payload.payload,
          }),
        });

        if (!response.ok) {
          throw new Error(`Webhook responded with status: ${response.status}`);
        }

        this.logger.debug(
          `Webhook dispatched successfully for event ${payload.id}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to dispatch webhook for event ${payload.id}`,
          err,
        );
        throw err;
      }
    } else {
      this.logger.debug(
        `[SIMULATED WEBHOOK] Event ${payload.event_type} for Org ${payload.organization_id} - payload: ${JSON.stringify(payload.payload)}`,
      );
    }
  }
}
