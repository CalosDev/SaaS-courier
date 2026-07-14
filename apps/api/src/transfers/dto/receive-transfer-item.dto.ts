import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { FacilityTransferItemStatus } from '../../generated/prisma/client';

export class ReceiveTransferItemDto {
  @IsIn([
    FacilityTransferItemStatus.RECEIVED,
    FacilityTransferItemStatus.MISSING,
    FacilityTransferItemStatus.DAMAGED,
  ])
  @IsNotEmpty()
  status!: FacilityTransferItemStatus;

  @ValidateIf(
    (dto: ReceiveTransferItemDto) =>
      dto.status === FacilityTransferItemStatus.RECEIVED ||
      dto.status === FacilityTransferItemStatus.DAMAGED,
  )
  @IsUUID()
  @IsNotEmpty()
  destinationLocationId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
