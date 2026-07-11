import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateDispatchDto {
  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  destination?: string;

  @IsDateString()
  @IsOptional()
  departureTime?: string;

  @IsDateString()
  @IsOptional()
  estimatedArrivalTime?: string;

  @IsString()
  @IsOptional()
  carrier?: string;

  @IsString()
  @IsOptional()
  flightNumber?: string;

  @IsString()
  @IsOptional()
  mawb?: string;
}
