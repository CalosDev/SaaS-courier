import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
} from 'class-validator';
import { DeliveryMethod } from '../../generated/prisma/client';

export class CreateDeliveryDto {
  @IsNotEmpty()
  @IsString()
  deliveryNumber!: string;

  @IsNotEmpty()
  @IsUUID()
  customerId!: string;

  @IsNotEmpty()
  @IsEnum(DeliveryMethod)
  method!: DeliveryMethod;

  @IsOptional()
  @IsObject()
  deliveryAddressSnap?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsArray()
  @IsUUID(4, { each: true })
  packageIds!: string[];
}
