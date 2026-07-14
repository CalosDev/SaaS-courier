import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationDeliveriesController } from './notification-deliveries.controller';
import { NotificationDeliveryProcessor } from './notification-delivery.processor';
import { NotificationOutboxConsumer } from './notification-outbox.consumer';
import { NotificationsService } from './notifications.service';
import { NotificationTemplatesController } from './notification-templates.controller';
import { SmtpEmailSender } from './smtp-email.sender';

@Module({
  imports: [PrismaModule],
  controllers: [
    NotificationTemplatesController,
    NotificationDeliveriesController,
  ],
  providers: [
    NotificationsService,
    NotificationOutboxConsumer,
    NotificationDeliveryProcessor,
    SmtpEmailSender,
  ],
  exports: [NotificationsService, SmtpEmailSender],
})
export class NotificationsModule {}
