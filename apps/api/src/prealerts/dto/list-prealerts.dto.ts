import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PREALERT_INVOICE_STATUS_VALUES,
  PREALERT_STATUS_VALUES,
} from '../prealert.types';

export class ListPrealertsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @IsOptional()
  @IsIn(PREALERT_STATUS_VALUES)
  status?: (typeof PREALERT_STATUS_VALUES)[number];

  @IsOptional()
  @IsIn(PREALERT_INVOICE_STATUS_VALUES)
  invoiceStatus?: (typeof PREALERT_INVOICE_STATUS_VALUES)[number];

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @IsOptional()
  @IsISO8601()
  createdTo?: string;
}
