import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DeliveryAttemptResult } from '../../generated/prisma/client';

export class RecordAttemptDto {
  @IsNotEmpty()
  @IsEnum(DeliveryAttemptResult)
  result!: DeliveryAttemptResult;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  receiverName?: string;
}
