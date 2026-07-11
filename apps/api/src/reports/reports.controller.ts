import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CurrentSession } from '../auth/http/current-session.decorator';
import type { SessionContext } from '../sessions/session.types';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-metrics')
  @RequirePermissions('organizations.read')
  async getDashboardMetrics(@CurrentSession() session: SessionContext) {
    return this.reportsService.getDashboardMetrics(session.organizationId);
  }

  @Get('packages-export.csv')
  @RequirePermissions('packages.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="packages_export.csv"')
  async exportPackagesCsv(
    @CurrentSession() session: SessionContext,
    @Res() res: Response,
  ) {
    const csvData = await this.reportsService.getPackagesExportCsv(
      session.organizationId,
    );
    res.send(csvData);
  }
}
