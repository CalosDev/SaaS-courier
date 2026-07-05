import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdatePackageDto {
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
  notes?: string | null;
}
