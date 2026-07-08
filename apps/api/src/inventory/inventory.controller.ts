import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { ListInventoryPackagesDto } from './dto/list-inventory-packages.dto';
import { ListWarehouseLocationsDto } from './dto/list-warehouse-locations.dto';
import { MoveInventoryPackageDto } from './dto/move-inventory-package.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { InventoryService } from './inventory.service';
import type {
  InventoryMovementRecord,
  InventoryPackageListResult,
  InventoryPackageRecord,
  WarehouseLocationListResult,
  WarehouseLocationRecord,
} from './inventory.types';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('locations')
  @RequirePermissions('inventory.read')
  async listLocations(
    @CurrentSession() session: SessionContext,
    @Query() query: ListWarehouseLocationsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.inventoryService.listLocations(
      session.organizationId,
      query,
    );

    return this.serializeLocationList(result);
  }

  @Post('locations')
  @RequirePermissions('inventory.manage')
  @HttpCode(201)
  async createLocation(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateWarehouseLocationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const created = await this.inventoryService.createLocation(
      session.organizationId,
      body,
      context,
    );

    return this.serializeLocation(created);
  }

  @Patch('locations/:locationId')
  @RequirePermissions('inventory.manage')
  async updateLocation(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('locationId', new ParseUUIDPipe({ version: '4' }))
    locationId: string,
    @Body() body: UpdateWarehouseLocationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const updated = await this.inventoryService.updateLocation(
      session.organizationId,
      locationId,
      body,
      context,
    );

    return this.serializeLocation(updated);
  }

  @Get('packages')
  @RequirePermissions('inventory.read')
  async listPackages(
    @CurrentSession() session: SessionContext,
    @Query() query: ListInventoryPackagesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.inventoryService.listPackages(
      session.organizationId,
      query,
    );

    return this.serializePackageList(result);
  }

  @Post('packages/:packageId/move')
  @RequirePermissions('inventory.manage')
  @HttpCode(200)
  async movePackage(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Body() body: MoveInventoryPackageDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const moved = await this.inventoryService.movePackage(
      session.organizationId,
      packageId,
      body,
      context,
    );

    return this.serializeInventoryPackage(moved);
  }

  @Get('packages/:packageId/movements')
  @RequirePermissions('inventory.read')
  async listPackageMovements(
    @CurrentSession() session: SessionContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const items = await this.inventoryService.listPackageMovements(
      session.organizationId,
      packageId,
    );

    return {
      items: items.map((item) => this.serializeMovement(item)),
    };
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeLocationList(result: WarehouseLocationListResult) {
    return {
      items: result.items.map((item) => this.serializeLocation(item)),
      pagination: result.pagination,
    };
  }

  private serializeLocation(location: WarehouseLocationRecord) {
    return {
      id: location.id,
      facility: location.facility,
      code: location.code,
      name: location.name,
      type: location.type,
      description: location.description,
      isActive: location.isActive,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    };
  }

  private serializePackageList(result: InventoryPackageListResult) {
    return {
      items: result.items.map((item) => this.serializeInventoryPackage(item)),
      pagination: result.pagination,
    };
  }

  private serializeInventoryPackage(record: InventoryPackageRecord) {
    return {
      id: record.id,
      internalTrackingNumber: record.internalTrackingNumber,
      externalTrackingNumber: record.externalTrackingNumber,
      status: record.status,
      customer: record.customer,
      reception: {
        facility: record.reception.facility,
        receivedAt: record.reception.receivedAt.toISOString(),
      },
      currentPosition: record.currentPosition
        ? {
            location: record.currentPosition.location,
            placedAt: record.currentPosition.placedAt.toISOString(),
            updatedAt: record.currentPosition.updatedAt.toISOString(),
          }
        : null,
    };
  }

  private serializeMovement(record: InventoryMovementRecord) {
    return {
      id: record.id,
      packageId: record.packageId,
      facility: record.facility,
      movementType: record.movementType,
      fromLocation: record.fromLocation,
      toLocation: record.toLocation,
      movedBy: record.movedBy,
      note: record.note,
      occurredAt: record.occurredAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }
}
