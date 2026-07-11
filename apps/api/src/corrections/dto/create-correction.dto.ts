import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  CorrectionStatus,
  CorrectionTargetType,
} from '../../generated/prisma/client';

export class CreateCorrectionDto {
  @IsEnum(CorrectionTargetType)
  @IsNotEmpty()
  targetType!: CorrectionTargetType;

  @IsUUID()
  @IsNotEmpty()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsObject()
  @IsNotEmpty()
  proposedData!: Record<string, any>;

  @IsEnum(CorrectionStatus)
  @IsOptional()
  status?: CorrectionStatus;
}
