import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCurrentOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  commercialName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  rnc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
