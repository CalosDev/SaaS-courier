import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  COURIER_REGISTRATION_STATUS_VALUES,
  ELECTRONIC_INVOICING_STATUS_VALUES,
  type CourierRegistrationStatus,
  type ElectronicInvoicingStatus,
} from '../organization-regulatory-profile.types';

export class UpdateOrganizationRegulatoryProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fiscalAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  authorizedRepresentativeName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  authorizedRepresentativeEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  authorizedRepresentativePhone?: string;

  @IsOptional()
  @IsIn(COURIER_REGISTRATION_STATUS_VALUES)
  courierRegistrationStatus?: CourierRegistrationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dgaOperatorCode?: string;

  @IsOptional()
  @IsIn(ELECTRONIC_INVOICING_STATUS_VALUES)
  electronicInvoicingStatus?: ElectronicInvoicingStatus;
}
