import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { PREALERT_INVOICE_STATUS_VALUES } from '../prealert.types';

function normalizeDecimalInput(value: unknown): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  return value;
}

export class UpdatePrealertDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalTrackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrierName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  storeName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  purchaseDate?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeDecimalInput(value))
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  declaredValue?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsIn(PREALERT_INVOICE_STATUS_VALUES)
  invoiceStatus?: (typeof PREALERT_INVOICE_STATUS_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
