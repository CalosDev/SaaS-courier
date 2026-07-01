import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { CUSTOMER_TYPE_VALUES } from '../customer.types';

export class CreateCustomerDto {
  @IsIn(CUSTOMER_TYPE_VALUES)
  type!: (typeof CUSTOMER_TYPE_VALUES)[number];

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
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
