import {
  IsArray,
  IsUUID,
  IsNotEmpty,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';

export class CreatePickupRequestDto {
  @IsUUID('4')
  @IsNotEmpty()
  facilityId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  customerId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  packageIds!: string[];
}
