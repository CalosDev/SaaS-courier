import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export const REPORT_TYPES = [
  'OPERATIONS',
  'INVENTORY',
  'BILLING',
  'SHIPMENTS',
  'CUSTOMS',
] as const;

export type ReportTypeValue = (typeof REPORT_TYPES)[number];

export class CreateReportExportDto {
  @IsIn(REPORT_TYPES)
  reportType!: ReportTypeValue;

  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;
}
