import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  FACILITY_OWNERSHIP_TYPE_VALUES,
  FACILITY_TYPE_VALUES,
} from '../facility.types';

export class UpdateFacilityDto {
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
  @IsIn(FACILITY_TYPE_VALUES)
  type?: (typeof FACILITY_TYPE_VALUES)[number];

  @IsOptional()
  @IsString()
  @IsIn(FACILITY_OWNERSHIP_TYPE_VALUES)
  ownershipType?: (typeof FACILITY_OWNERSHIP_TYPE_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsBoolean()
  isCustomerFacing?: boolean;

  @IsOptional()
  @IsBoolean()
  isPackageOrigin?: boolean;

  @IsOptional()
  @IsBoolean()
  isDistributionCenter?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
