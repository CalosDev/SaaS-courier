import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

export class ApplyPaymentDto {
  @IsUUID()
  invoiceId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d*$/)
  amountMinor: string;
}
