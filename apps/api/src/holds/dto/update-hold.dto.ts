import { IsEnum, IsOptional, IsString } from 'class-validator';
import { HoldStatus } from '../../generated/prisma/client';

export class UpdateHoldDto {
  @IsEnum(HoldStatus)
  @IsOptional()
  status?: HoldStatus;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  releaseReason?: string;
}
