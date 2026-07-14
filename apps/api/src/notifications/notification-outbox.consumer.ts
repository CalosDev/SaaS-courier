import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationOutboxConsumer {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('**')
  consume(event: Record<string, unknown>): Promise<void> {
    return this.notifications.consumeOutboxEvent(event);
  }
}
