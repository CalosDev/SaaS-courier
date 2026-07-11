import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AddPackagesDto } from './dto/add-packages.dto';
import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { UpdateDispatchDto } from './dto/update-dispatch.dto';
import { DispatchesService } from './dispatches.service';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';

@Controller('master-shipments')
export class MasterShipmentsController {
  constructor(private readonly dispatchesService: DispatchesService) {}

  @Post()
  @RequirePermissions('dispatches.manage')
  async createMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() dto: CreateDispatchDto,
  ) {
    return this.dispatchesService.createDispatch(ctx, dto);
  }

  @Get()
  @RequirePermissions('dispatches.read')
  async getMasterShipments(@CurrentCommandContext() ctx: CommandContext) {
    return this.dispatchesService.getDispatches(ctx.organizationId);
  }

  @Get(':id')
  @RequirePermissions('dispatches.read')
  async getMasterShipmentById(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.dispatchesService.getDispatchById(ctx.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('dispatches.manage')
  async updateMasterShipment(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: UpdateDispatchDto,
  ) {
    return this.dispatchesService.updateDispatch(ctx, id, dto);
  }

  @Post(':id/packages')
  @RequirePermissions('dispatches.manage')
  async addPackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: AddPackagesDto,
  ) {
    return this.dispatchesService.addPackages(ctx, id, dto);
  }

  @Delete(':id/packages')
  @RequirePermissions('dispatches.manage')
  async removePackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: AddPackagesDto,
  ) {
    return this.dispatchesService.removePackages(ctx, id, dto);
  }
}
