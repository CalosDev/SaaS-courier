import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { RATE_CALCULATION_TYPE_VALUES } from '../rates.types';

export class UpdateRateCardDto {
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  segmentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  segmentName?: string;

  @IsOptional()
  @IsString()
  @IsIn(RATE_CALCULATION_TYPE_VALUES)
  calculationType?: (typeof RATE_CALCULATION_TYPE_VALUES)[number];
}
