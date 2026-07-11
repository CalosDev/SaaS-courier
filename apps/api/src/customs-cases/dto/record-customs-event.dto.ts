import { CustomsEventSource } from '../../generated/prisma/client';
import { IsEnum, IsString, MaxLength, IsDateString } from 'class-validator';

export class RecordCustomsEventDto {
  @IsEnum(CustomsEventSource)
  source!: CustomsEventSource;

  @IsDateString()
  eventDate!: string;

  @IsString()
  @MaxLength(1000)
  description!: string;
}
