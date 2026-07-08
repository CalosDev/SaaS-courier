import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { WAREHOUSE_LOCATION_TYPE_VALUES } from '../inventory.types';

export class CreateWarehouseLocationDto {
  @IsUUID('4')
  facilityId!: string;

  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(WAREHOUSE_LOCATION_TYPE_VALUES)
  type!: (typeof WAREHOUSE_LOCATION_TYPE_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
