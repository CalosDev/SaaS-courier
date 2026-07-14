import { CustomsEventSource } from '../../generated/prisma/client';
import {
  IsEnum,
  IsString,
  MaxLength,
  IsDateString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class RecordCustomsEventDto {
  @IsEnum(CustomsEventSource)
  source!: CustomsEventSource;

  @IsDateString()
  eventDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  evidenceReference?: string;
}
