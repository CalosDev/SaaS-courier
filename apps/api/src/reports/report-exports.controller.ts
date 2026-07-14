import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CreateReportExportDto } from './dto/create-report-export.dto';
import { ReportsService } from './reports.service';

@Controller('report-exports')
export class ReportExportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @RequirePermissions('reports.export')
  requestExport(
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateReportExportDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reportsService.requestExport(context, body, idempotencyKey);
  }

  @Get(':exportId')
  @RequirePermissions('reports.export')
  getExport(
    @CurrentCommandContext() context: CommandContext,
    @Param('exportId', ParseUUIDPipe) exportId: string,
  ) {
    return this.reportsService.getExport(context.organizationId, exportId);
  }

  @Get(':exportId/download')
  @RequirePermissions('reports.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async download(
    @CurrentCommandContext() context: CommandContext,
    @Param('exportId', ParseUUIDPipe) exportId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.reportsService.downloadExport(context, exportId);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.content);
  }
}
