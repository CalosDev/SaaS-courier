import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CarrierWebhookDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  trackingNumber!: string;

  @IsString()
  @IsIn(['IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'UNKNOWN'])
  status!: 'IN_TRANSIT' | 'DELIVERED' | 'EXCEPTION' | 'UNKNOWN';

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
