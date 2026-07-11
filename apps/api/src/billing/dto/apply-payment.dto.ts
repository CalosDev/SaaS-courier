import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ApplyPaymentDto {
  @IsUUID()
  invoiceId: string;

  @IsString()
  @IsNotEmpty()
  amountMinor: string;
}
