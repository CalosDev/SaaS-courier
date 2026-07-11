import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CorrectionStatus } from '../../generated/prisma/client';

export class UpdateCorrectionDto {
  @IsEnum(CorrectionStatus)
  @IsOptional()
  status?: CorrectionStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
