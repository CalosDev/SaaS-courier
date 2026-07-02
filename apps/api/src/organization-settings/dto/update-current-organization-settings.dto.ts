import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CUSTOMER_CODE_STRATEGY_VALUES,
  DATE_DISPLAY_FORMAT_VALUES,
  DIMENSION_UNIT_VALUES,
  WEIGHT_UNIT_VALUES,
} from '../organization-settings.types';

export class UpdateCurrentOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @IsOptional()
  @IsIn(DATE_DISPLAY_FORMAT_VALUES)
  dateFormat?: (typeof DATE_DISPLAY_FORMAT_VALUES)[number];

  @IsOptional()
  @IsIn(WEIGHT_UNIT_VALUES)
  weightUnit?: (typeof WEIGHT_UNIT_VALUES)[number];

  @IsOptional()
  @IsIn(DIMENSION_UNIT_VALUES)
  dimensionUnit?: (typeof DIMENSION_UNIT_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsIn(CUSTOMER_CODE_STRATEGY_VALUES)
  customerCodeStrategy?: (typeof CUSTOMER_CODE_STRATEGY_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(8)
  customerCodePrefix?: string;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(16)
  customerCodeRandomLength?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(12)
  customerCodeSequencePadding?: number;
}
