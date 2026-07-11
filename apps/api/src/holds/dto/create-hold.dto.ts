import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { HoldStatus } from '../../generated/prisma/client';

export class CreateHoldDto {
  @IsUUID()
  @IsNotEmpty()
  packageId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsEnum(HoldStatus)
  @IsOptional()
  status?: HoldStatus;
}
