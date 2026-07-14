import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
  ArrayNotEmpty,
  ArrayUnique,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DeliveryMethod } from '../../generated/prisma/client';

export class CreateDeliveryDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  deliveryNumber!: string;

  @IsNotEmpty()
  @IsUUID()
  customerId!: string;

  @IsNotEmpty()
  @IsEnum(DeliveryMethod)
  method!: DeliveryMethod;

  @ValidateIf((dto: CreateDeliveryDto) => dto.method === 'HOME_DELIVERY')
  @IsNotEmpty()
  @IsObject()
  deliveryAddressSnap?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(4, { each: true })
  packageIds!: string[];
}
