import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  CUSTOMS_REGISTRATION_STATUS_VALUES,
  CUSTOMS_VERIFICATION_SOURCE_VALUES,
} from '../customer.types';

export class UpdateCustomerCustomsVerificationDto {
  @IsIn(CUSTOMS_REGISTRATION_STATUS_VALUES)
  status!: (typeof CUSTOMS_REGISTRATION_STATUS_VALUES)[number];

  @IsOptional()
  @IsIn(CUSTOMS_VERIFICATION_SOURCE_VALUES)
  source?: (typeof CUSTOMS_VERIFICATION_SOURCE_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  checkedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
