import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { WAREHOUSE_LOCATION_TYPE_VALUES } from '../inventory.types';

export class UpdateWarehouseLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(WAREHOUSE_LOCATION_TYPE_VALUES)
  type?: (typeof WAREHOUSE_LOCATION_TYPE_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
