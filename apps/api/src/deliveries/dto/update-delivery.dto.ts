import {
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @IsOptional()
  @IsObject()
  deliveryAddressSnap?: Record<string, unknown>;
}
