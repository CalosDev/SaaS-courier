import { IsISO8601, IsOptional } from 'class-validator';

export class ReportFilterDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;
}
