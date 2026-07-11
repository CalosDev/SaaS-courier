import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateHouseShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hawb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
