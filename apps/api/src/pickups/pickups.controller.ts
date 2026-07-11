import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PickupRequestsService } from './pickups.service';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dto/update-pickup-request.dto';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';

@Controller('pickup-requests')
export class PickupRequestsController {
  constructor(private readonly pickupRequestsService: PickupRequestsService) {}

  @Post()
  @RequirePermissions('pickups.manage')
  create(
    @CurrentCommandContext() context: CommandContext,
    @Body() createPickupRequestDto: CreatePickupRequestDto,
  ) {
    return this.pickupRequestsService.create(context, createPickupRequestDto);
  }

  @Get()
  @RequirePermissions('pickups.read')
  findAll(@CurrentCommandContext() context: CommandContext) {
    return this.pickupRequestsService.findAll(context);
  }

  @Get(':id')
  @RequirePermissions('pickups.read')
  findOne(
    @CurrentCommandContext() context: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pickupRequestsService.findOne(context, id);
  }

  @Patch(':id')
  @RequirePermissions('pickups.manage')
  update(
    @CurrentCommandContext() context: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePickupRequestDto: UpdatePickupRequestDto,
  ) {
    return this.pickupRequestsService.update(
      context,
      id,
      updatePickupRequestDto,
    );
  }

  @Post(':id/ready')
  @RequirePermissions('pickups.manage')
  markAsReady(
    @CurrentCommandContext() context: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pickupRequestsService.markAsReady(context, id);
  }

  @Post(':id/complete')
  @RequirePermissions('pickups.manage')
  complete(
    @CurrentCommandContext() context: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pickupRequestsService.complete(context, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('pickups.manage')
  cancel(
    @CurrentCommandContext() context: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pickupRequestsService.cancel(context, id);
  }
}
