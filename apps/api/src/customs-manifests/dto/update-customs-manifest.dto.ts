import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCustomsManifestDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  flightNumber?: string;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;
}
