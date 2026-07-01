import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { CUSTOMER_STATUS_VALUES } from '../customer.types';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  mobilePhone?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUS_VALUES)
  status?: (typeof CUSTOMER_STATUS_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
