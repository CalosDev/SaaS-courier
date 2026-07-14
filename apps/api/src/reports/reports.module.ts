import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportExportsController } from './report-exports.controller';
import { ReportExportsProcessor } from './report-exports.processor';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController, ReportExportsController],
  providers: [ReportsService, ReportExportsProcessor],
})
export class ReportsModule {}
