import { IsEnum, IsUUID } from 'class-validator';
import { TransportMode } from '../../generated/prisma/client';
import { CreateDispatchDto } from './create-dispatch.dto';

export class CreateMasterShipmentDto extends CreateDispatchDto {
  @IsUUID(4)
  originFacilityId!: string;

  @IsUUID(4)
  destinationFacilityId!: string;

  @IsEnum(TransportMode)
  transportMode!: TransportMode;
}
