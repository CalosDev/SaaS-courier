import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';

import { ReportsService } from './reports.service';

const scheduledProcessingDisabled = process.env.NODE_ENV === 'test';

@Injectable()
export class ReportExportsProcessor {
  constructor(private readonly reportsService: ReportsService) {}

  @Cron(CronExpression.EVERY_10_SECONDS, {
    disabled: scheduledProcessingDisabled,
  })
  processScheduled(): Promise<void> {
    return this.reportsService.processPendingExports();
  }

  @OnEvent('report_export.requested')
  processRequested(): Promise<void> {
    return this.reportsService.processPendingExports();
  }
}
