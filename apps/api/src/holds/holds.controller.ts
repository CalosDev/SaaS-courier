import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { HoldsService } from './holds.service';
import { CreateHoldDto } from './dto/create-hold.dto';
import { ReleaseHoldDto } from './dto/release-hold.dto';
import { UpdateHoldDto } from './dto/update-hold.dto';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';

@Controller('holds')
export class HoldsController {
  constructor(private readonly holdsService: HoldsService) {}

  @Post()
  @RequirePermissions('holds.manage')
  async createHold(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() dto: CreateHoldDto,
  ) {
    return this.holdsService.createHold(ctx, dto);
  }

  @Get()
  @RequirePermissions('holds.read')
  async getHolds(
    @CurrentCommandContext() ctx: CommandContext,
    @Query('packageId') packageId?: string,
  ) {
    return this.holdsService.getHolds(ctx.organizationId, packageId);
  }

  @Get(':id')
  @RequirePermissions('holds.read')
  async getHoldById(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.holdsService.getHoldById(ctx.organizationId, id);
  }

  @Post(':id/release')
  @RequirePermissions('holds.manage')
  async releaseHold(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: ReleaseHoldDto,
  ) {
    return this.holdsService.releaseHold(ctx, id, dto);
  }

  @Patch(':id')
  @RequirePermissions('holds.manage')
  async updateHold(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: UpdateHoldDto,
  ) {
    return this.holdsService.updateHold(ctx, id, dto);
  }
}
