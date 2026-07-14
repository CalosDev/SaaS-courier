import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationDeliveryProcessor {
  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_10_SECONDS, {
    disabled: process.env.NODE_ENV === 'test',
  })
  process(): Promise<void> {
    return this.notifications.processPendingDeliveries();
  }
}
