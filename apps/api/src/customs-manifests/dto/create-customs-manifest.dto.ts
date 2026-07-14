import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCustomsManifestDto {
  @IsUUID(4)
  masterShipmentId!: string;

  @IsString()
  @MaxLength(40)
  flightNumber!: string;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;
}
