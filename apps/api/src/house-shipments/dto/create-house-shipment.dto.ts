import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateHouseShipmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  hawb: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
