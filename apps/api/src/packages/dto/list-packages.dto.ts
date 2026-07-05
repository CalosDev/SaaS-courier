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

import { PACKAGE_SOURCE_VALUES, PACKAGE_STATUS_VALUES } from '../package.types';

export class ListPackagesDto {
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
  @IsIn(PACKAGE_STATUS_VALUES)
  status?: (typeof PACKAGE_STATUS_VALUES)[number];

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsUUID('4')
  prealertId?: string;

  @IsOptional()
  @IsIn(PACKAGE_SOURCE_VALUES)
  source?: (typeof PACKAGE_SOURCE_VALUES)[number];

  @IsOptional()
  @IsISO8601()
  registeredFrom?: string;

  @IsOptional()
  @IsISO8601()
  registeredTo?: string;
}
