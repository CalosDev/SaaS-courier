import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CustomsCasesService } from './customs-cases.service';
import { CreateCustomsCaseDto } from './dto/create-customs-case.dto';
import { RecordCustomsEventDto } from './dto/record-customs-event.dto';
import { ChangeCustomsCaseStatusDto } from './dto/change-customs-case-status.dto';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CUSTOMS_PERMISSIONS } from '../rbac/permission.catalog';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';

@Controller('customs-cases')
export class CustomsCasesController {
  constructor(private readonly service: CustomsCasesService) {}

  @Get()
  @RequirePermissions(CUSTOMS_PERMISSIONS.READ)
  async findAll(@CurrentCommandContext() ctx: CommandContext) {
    return this.service.findAll(ctx, {});
  }

  @Post()
  @RequirePermissions(CUSTOMS_PERMISSIONS.MANAGE)
  async create(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() dto: CreateCustomsCaseDto,
  ) {
    return this.service.create(ctx, dto);
  }

  @Get(':id')
  @RequirePermissions(CUSTOMS_PERMISSIONS.READ)
  async findById(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findById(ctx, id);
  }

  @Post(':id/events')
  @RequirePermissions(CUSTOMS_PERMISSIONS.MANAGE)
  async recordEvent(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordCustomsEventDto,
  ) {
    return this.service.recordEvent(ctx, id, dto);
  }

  @Post(':id/status')
  @RequirePermissions(CUSTOMS_PERMISSIONS.MANAGE)
  async changeStatus(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeCustomsCaseStatusDto,
  ) {
    return this.service.changeStatus(ctx, id, dto);
  }
}
