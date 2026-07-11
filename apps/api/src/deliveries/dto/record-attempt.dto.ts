import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DeliveryAttemptResult } from '../../generated/prisma/client';

export class RecordAttemptDto {
  @IsNotEmpty()
  @IsEnum(DeliveryAttemptResult)
  result!: DeliveryAttemptResult;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiverName?: string;
}
