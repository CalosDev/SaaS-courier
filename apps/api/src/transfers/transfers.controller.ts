import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { TRANSFER_PERMISSIONS } from '../rbac/permission.catalog';
import type { CommandContext } from '../request-context/request-context.types';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { AddTransferItemDto } from './dto/add-transfer-item.dto';
import { ReceiveTransferItemDto } from './dto/receive-transfer-item.dto';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @RequirePermissions(TRANSFER_PERMISSIONS.MANAGE)
  createTransfer(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transfersService.createTransfer(ctx, dto);
  }

  @Get()
  @RequirePermissions(TRANSFER_PERMISSIONS.VIEW)
  getTransfers(@CurrentCommandContext() ctx: CommandContext) {
    return this.transfersService.getTransfers(ctx);
  }

  @Get(':id')
  @RequirePermissions(TRANSFER_PERMISSIONS.VIEW)
  getTransferById(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') transferId: string,
  ) {
    return this.transfersService.getTransferById(ctx, transferId);
  }

  @Post(':id/items')
  @RequirePermissions(TRANSFER_PERMISSIONS.MANAGE)
  addItem(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') transferId: string,
    @Body() dto: AddTransferItemDto,
  ) {
    return this.transfersService.addItem(ctx, transferId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(TRANSFER_PERMISSIONS.MANAGE)
  removeItem(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') transferId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.transfersService.removeItem(ctx, transferId, itemId);
  }

  @Post(':id/dispatch')
  @RequirePermissions(TRANSFER_PERMISSIONS.MANAGE)
  dispatchTransfer(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') transferId: string,
  ) {
    return this.transfersService.dispatchTransfer(ctx, transferId);
  }

  @Put(':id/items/:itemId/receive')
  @RequirePermissions(TRANSFER_PERMISSIONS.MANAGE)
  receiveItem(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') transferId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReceiveTransferItemDto,
  ) {
    return this.transfersService.receiveItem(ctx, transferId, itemId, dto);
  }
}
