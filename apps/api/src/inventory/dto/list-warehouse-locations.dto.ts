import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { WAREHOUSE_LOCATION_TYPE_VALUES } from '../inventory.types';

export class ListWarehouseLocationsDto {
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
  @IsUUID('4')
  facilityId?: string;

  @IsOptional()
  @IsIn(WAREHOUSE_LOCATION_TYPE_VALUES)
  type?: (typeof WAREHOUSE_LOCATION_TYPE_VALUES)[number];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
