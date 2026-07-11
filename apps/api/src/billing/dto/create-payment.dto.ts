import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  customerId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  amountMinor: string;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
