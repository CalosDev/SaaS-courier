import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FacilityTransferItemStatus } from '../../generated/prisma/client';

export class ReceiveTransferItemDto {
  @IsEnum(FacilityTransferItemStatus)
  @IsNotEmpty()
  status!: FacilityTransferItemStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
