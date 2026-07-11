import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DispatchStatus } from '../../generated/prisma/client';

export class UpdateDispatchDto {
  @IsEnum(DispatchStatus)
  @IsOptional()
  status?: DispatchStatus;

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

  @IsDateString()
  @IsOptional()
  actualArrivalTime?: string;

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
