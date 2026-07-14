import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  @IsNotEmpty()
  originFacilityId!: string;

  @IsUUID()
  @IsNotEmpty()
  destinationFacilityId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
