import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { CorrectionsService } from './corrections.service';
import { CreateCorrectionDto } from './dto/create-correction.dto';
import { UpdateCorrectionDto } from './dto/update-correction.dto';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { CorrectionTargetType } from '../generated/prisma/client';

@Controller('corrections')
export class CorrectionsController {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Post()
  @RequirePermissions('corrections.manage')
  async createCorrectionRequest(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() dto: CreateCorrectionDto,
  ) {
    return this.correctionsService.createCorrectionRequest(ctx, dto);
  }

  @Get()
  @RequirePermissions('corrections.read')
  async getCorrectionRequests(
    @CurrentCommandContext() ctx: CommandContext,
    @Query('targetType') targetType?: CorrectionTargetType,
    @Query('targetId') targetId?: string,
  ) {
    return this.correctionsService.getCorrectionRequests(
      ctx.organizationId,
      targetType,
      targetId,
    );
  }

  @Get(':id')
  @RequirePermissions('corrections.read')
  async getCorrectionRequestById(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.correctionsService.getCorrectionRequestById(
      ctx.organizationId,
      id,
    );
  }

  @Patch(':id')
  @RequirePermissions('corrections.manage')
  async updateCorrectionRequest(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: UpdateCorrectionDto,
  ) {
    return this.correctionsService.updateCorrectionRequest(ctx, id, dto);
  }
}
