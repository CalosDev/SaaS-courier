import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomsManifestDto {
  @IsString()
  @MaxLength(40)
  flightNumber!: string;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;
}
