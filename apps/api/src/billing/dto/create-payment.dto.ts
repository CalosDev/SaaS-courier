import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  customerId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d*$/)
  amountMinor: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/)
  currencyCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}
