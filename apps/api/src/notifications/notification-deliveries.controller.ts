import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { ListNotificationDeliveriesDto } from './dto/list-notification-deliveries.dto';
import { NotificationsService } from './notifications.service';

@Controller('notification-deliveries')
export class NotificationDeliveriesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications.read')
  list(
    @CurrentSession() session: SessionContext,
    @Query() query: ListNotificationDeliveriesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.notifications.listDeliveries(session.organizationId, query);
  }

  @Post(':deliveryId/retry')
  @HttpCode(200)
  @RequirePermissions('notifications.manage')
  retry(
    @CurrentCommandContext() context: CommandContext,
    @Param('deliveryId', new ParseUUIDPipe({ version: '4' }))
    deliveryId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.notifications.retryDelivery(context, deliveryId);
  }
}
