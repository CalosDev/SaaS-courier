import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { HouseShipmentsService } from './house-shipments.service';
import { CreateHouseShipmentDto } from './dto/create-house-shipment.dto';
import { UpdateHouseShipmentDto } from './dto/update-house-shipment.dto';
import { AddPackagesToHouseShipmentDto } from './dto/add-packages-to-house-shipment.dto';

import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { SHIPMENT_PERMISSIONS } from '../rbac/permission.catalog';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';

@Controller('house-shipments')
export class HouseShipmentsController {
  constructor(private readonly service: HouseShipmentsService) {}

  @Get(':id')
  @RequirePermissions(SHIPMENT_PERMISSIONS.VIEW)
  async getHouseShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findById(ctx, id);
  }

  @Patch(':id')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async updateHouseShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHouseShipmentDto,
  ) {
    return this.service.update(ctx, id, dto);
  }

  @Put(':id/packages')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async addPackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPackagesToHouseShipmentDto,
  ) {
    await this.service.addPackages(ctx, id, dto);
    return { success: true };
  }

  @Post(':id/close')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async closeHouseShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.close(ctx, id);
    return { success: true };
  }

  @Post(':id/cancel')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async cancelHouseShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.cancel(ctx, id);
    return { success: true };
  }
}

@Controller('master-shipments/:shipmentId')
export class MasterShipmentsHouseShipmentsController {
  constructor(private readonly service: HouseShipmentsService) {}

  @Get('house-shipments')
  @RequirePermissions(SHIPMENT_PERMISSIONS.VIEW)
  async getHouseShipments(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.service.findByDispatchId(ctx, shipmentId);
  }

  @Post('house-shipments')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async createHouseShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: CreateHouseShipmentDto,
  ) {
    return this.service.create(ctx, shipmentId, dto);
  }
}
