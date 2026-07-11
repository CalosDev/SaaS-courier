import {
  IsArray,
  IsUUID,
  IsOptional,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';

export class UpdatePickupRequestDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  packageIds?: string[];
}
