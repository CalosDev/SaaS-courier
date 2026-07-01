import { Type } from 'class-transformer';
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
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
} from '../customer.types';

export class ListCustomersDto {
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
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(CUSTOMER_TYPE_VALUES)
  type?: (typeof CUSTOMER_TYPE_VALUES)[number];

  @IsOptional()
  @IsIn(CUSTOMER_STATUS_VALUES)
  status?: (typeof CUSTOMER_STATUS_VALUES)[number];
}
