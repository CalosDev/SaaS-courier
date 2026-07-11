import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { RecordAttemptDto } from './dto/record-attempt.dto';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { CommandContext } from '../request-context/request-context.types';

@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @RequirePermissions('deliveries.read')
  findAll(@CurrentCommandContext() ctx: CommandContext) {
    return this.deliveriesService.findAll(ctx);
  }

  @Post()
  @RequirePermissions('deliveries.manage')
  create(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() createDto: CreateDeliveryDto,
  ) {
    return this.deliveriesService.create(ctx, createDto);
  }

  @Get(':id')
  @RequirePermissions('deliveries.read')
  findOne(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.deliveriesService.findOne(ctx, id);
  }

  @Patch(':id')
  @RequirePermissions('deliveries.manage')
  update(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() updateDto: UpdateDeliveryDto,
  ) {
    return this.deliveriesService.update(ctx, id, updateDto);
  }

  @Post(':id/ready')
  @RequirePermissions('deliveries.manage')
  markReady(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.deliveriesService.markReady(ctx, id);
  }

  @Post(':id/dispatch')
  @RequirePermissions('deliveries.manage')
  dispatch(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.deliveriesService.dispatch(ctx, id);
  }

  @Post(':id/attempts')
  @RequirePermissions('deliveries.manage')
  recordAttempt(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() attemptDto: RecordAttemptDto,
  ) {
    return this.deliveriesService.recordAttempt(ctx, id, attemptDto);
  }

  @Post(':id/cancel')
  @RequirePermissions('deliveries.manage')
  cancel(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.deliveriesService.cancel(ctx, id);
  }
}
