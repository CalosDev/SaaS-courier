import { Controller, Get, Query } from '@nestjs/common';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-metrics')
  @RequirePermissions('organizations.read')
  getDashboardMetrics(@CurrentSession() session: SessionContext) {
    return this.reportsService.getDashboardMetrics(session.organizationId);
  }

  @Get('operations')
  @RequirePermissions('reports.read')
  operations(
    @CurrentSession() session: SessionContext,
    @Query() filters: ReportFilterDto,
  ) {
    return this.reportsService.getOperationsReport(
      session.organizationId,
      filters,
    );
  }

  @Get('inventory')
  @RequirePermissions('reports.read')
  inventory(
    @CurrentSession() session: SessionContext,
    @Query() filters: ReportFilterDto,
  ) {
    return this.reportsService.getInventoryReport(
      session.organizationId,
      filters,
    );
  }

  @Get('billing')
  @RequirePermissions('reports.read')
  billing(
    @CurrentSession() session: SessionContext,
    @Query() filters: ReportFilterDto,
  ) {
    return this.reportsService.getBillingReport(
      session.organizationId,
      filters,
    );
  }

  @Get('shipments')
  @RequirePermissions('reports.read')
  shipments(
    @CurrentSession() session: SessionContext,
    @Query() filters: ReportFilterDto,
  ) {
    return this.reportsService.getShipmentsReport(
      session.organizationId,
      filters,
    );
  }

  @Get('customs')
  @RequirePermissions('reports.read')
  customs(
    @CurrentSession() session: SessionContext,
    @Query() filters: ReportFilterDto,
  ) {
    return this.reportsService.getCustomsReport(
      session.organizationId,
      filters,
    );
  }
}
