import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { INVENTORY_MOVEMENT_TYPE_VALUES } from '../inventory.types';

export class MoveInventoryPackageDto {
  @IsString()
  @IsIn(INVENTORY_MOVEMENT_TYPE_VALUES)
  movementType!: (typeof INVENTORY_MOVEMENT_TYPE_VALUES)[number];

  @IsOptional()
  @IsUUID('4')
  toLocationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
