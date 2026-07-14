import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { BatchPutawayDto } from './dto/batch-putaway.dto';
import { WarehouseLookupDto } from './dto/warehouse-lookup.dto';
import { WarehouseService } from './warehouse.service';

@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('lookup')
  @RequirePermissions('inventory.read')
  lookup(
    @CurrentSession() session: SessionContext,
    @Query() query: WarehouseLookupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.warehouseService.lookup(session.organizationId, query.code);
  }

  @Post('batch/putaway')
  @RequirePermissions('inventory.manage')
  @HttpCode(200)
  batchPutaway(
    @CurrentCommandContext() context: CommandContext,
    @Body() body: BatchPutawayDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.warehouseService.batchPutaway(context, body);
  }
}
