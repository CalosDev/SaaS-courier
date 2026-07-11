import { IsOptional, IsString, IsUUID, IsObject } from 'class-validator';

export class UpdateDeliveryDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @IsOptional()
  @IsObject()
  deliveryAddressSnap?: Record<string, any>;
}
