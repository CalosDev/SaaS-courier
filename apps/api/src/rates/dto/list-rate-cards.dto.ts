import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { RATE_CARD_STATUS_VALUES } from '../rates.types';
import { IsIn } from 'class-validator';

export class ListRateCardsDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @IsOptional()
  @IsString()
  @IsIn(RATE_CARD_STATUS_VALUES)
  status?: (typeof RATE_CARD_STATUS_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  segmentKey?: string;
}
