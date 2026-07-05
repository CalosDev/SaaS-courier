import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePackageDto {
  @IsOptional()
  @IsUUID('4')
  prealertId?: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalTrackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
