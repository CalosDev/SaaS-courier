import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { AddPackagesDto } from './dto/add-packages.dto';
import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { UpdateMawbDto } from './dto/update-mawb.dto';
import { UpdateDispatchDto } from './dto/update-dispatch.dto';
import { DispatchesService } from './dispatches.service';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { SHIPMENT_PERMISSIONS } from '../rbac/permission.catalog';

@Controller('master-shipments')
export class MasterShipmentsController {
  constructor(private readonly dispatchesService: DispatchesService) {}

  @Post()
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async createMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() dto: CreateDispatchDto,
  ) {
    return this.dispatchesService.createDispatch(ctx, dto);
  }

  @Get()
  @RequirePermissions(SHIPMENT_PERMISSIONS.VIEW)
  async getMasterShipments(@CurrentCommandContext() ctx: CommandContext) {
    return this.dispatchesService.getDispatches(ctx.organizationId);
  }

  @Get(':id')
  @RequirePermissions(SHIPMENT_PERMISSIONS.VIEW)
  async getMasterShipmentById(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.dispatchesService.getDispatchById(ctx.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async updateMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: UpdateDispatchDto,
  ) {
    return this.dispatchesService.updateDispatch(ctx, id, dto);
  }

  @Patch(':id/mawb')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async updateMawb(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: UpdateMawbDto,
  ) {
    return this.dispatchesService.updateMasterShipmentMawb(ctx, id, dto.mawb);
  }

  @Put(':id/packages')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async replacePackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: AddPackagesDto,
  ) {
    return this.dispatchesService.replaceMasterShipmentPackages(ctx, id, dto);
  }

  @Post(':id/packages')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async addPackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: AddPackagesDto,
  ) {
    return this.dispatchesService.addPackages(ctx, id, dto);
  }

  @Delete(':id/packages')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async removePackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: AddPackagesDto,
  ) {
    return this.dispatchesService.removePackages(ctx, id, dto);
  }

  @Post(':id/close')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async closeMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.dispatchesService.closeMasterShipment(ctx, id);
  }

  @Post(':id/depart')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async departMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.dispatchesService.departMasterShipment(ctx, id);
  }

  @Post(':id/arrive')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async arriveMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.dispatchesService.arriveMasterShipment(ctx, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(SHIPMENT_PERMISSIONS.MANAGE)
  async cancelMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.dispatchesService.cancelMasterShipment(ctx, id);
  }
}
