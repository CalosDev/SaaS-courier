import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

import { RATE_CALCULATION_TYPE_VALUES } from '../rates.types';

export class CreateRateCardDto {
  @IsUUID('4')
  serviceId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(40)
  segmentKey!: string;

  @IsString()
  @MaxLength(120)
  segmentName!: string;

  @IsString()
  @IsIn(RATE_CALCULATION_TYPE_VALUES)
  calculationType!: (typeof RATE_CALCULATION_TYPE_VALUES)[number];
}
