import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES,
  CUSTOMS_REGISTRATION_STATUS_VALUES,
  MANUAL_CUSTOMS_VERIFICATION_SOURCE_VALUES,
} from '../customer.types';

export class UpsertCustomerCustomsProfileDto {
  @IsIn(CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES)
  documentType!: (typeof CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES)[number];

  @IsString()
  @MaxLength(30)
  documentNumber!: string;

  @IsOptional()
  @IsIn(CUSTOMS_REGISTRATION_STATUS_VALUES)
  status?: (typeof CUSTOMS_REGISTRATION_STATUS_VALUES)[number];

  @IsOptional()
  @IsIn(MANUAL_CUSTOMS_VERIFICATION_SOURCE_VALUES)
  source?: (typeof MANUAL_CUSTOMS_VERIFICATION_SOURCE_VALUES)[number];

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
