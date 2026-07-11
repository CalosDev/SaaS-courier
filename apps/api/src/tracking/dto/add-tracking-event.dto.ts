import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrackingEventType } from '../../generated/prisma/client';

export class AddTrackingEventDto {
  @IsEnum(TrackingEventType)
  eventType!: TrackingEventType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
