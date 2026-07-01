import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES } from '../customer.types';

export class UpsertCustomerCustomsProfileDto {
  @IsIn(CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES)
  documentType!: (typeof CUSTOMER_IDENTITY_DOCUMENT_TYPE_VALUES)[number];

  @IsString()
  @MaxLength(30)
  documentNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
