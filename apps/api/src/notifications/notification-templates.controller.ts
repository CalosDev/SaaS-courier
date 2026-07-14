import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { NotificationsService } from './notifications.service';

@Controller('notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications.read')
  list(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.notifications.listTemplates(session.organizationId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('notifications.manage')
  create(
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateNotificationTemplateDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.notifications.createTemplate(context, body);
  }

  @Patch(':templateId')
  @RequirePermissions('notifications.manage')
  update(
    @CurrentCommandContext() context: CommandContext,
    @Param('templateId', new ParseUUIDPipe({ version: '4' }))
    templateId: string,
    @Body() body: UpdateNotificationTemplateDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.notifications.updateTemplate(context, templateId, body);
  }
}
