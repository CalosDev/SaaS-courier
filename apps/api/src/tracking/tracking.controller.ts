import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { AddTrackingEventDto } from './dto/add-tracking-event.dto';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';

@Controller('packages/:packageId/tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get()
  @RequirePermissions('tracking.read')
  findAll(
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ) {
    return this.trackingService.findAllForPackage(context, packageId);
  }

  @Post()
  @RequirePermissions('tracking.manage')
  addEvent(
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: AddTrackingEventDto,
  ) {
    return this.trackingService.addEvent(context, packageId, dto);
  }
}
